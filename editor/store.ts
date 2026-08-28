/**
 * The only thing in the editor that touches the dataset file.
 *
 * Two promises hold this together. The first is that a dataset `pnpm run
 * validate` would reject never reaches the disk — validation happens before
 * serialization, and serialization before the write. The second is that a
 * formatting bug cannot lose data: the serialized text is parsed back and
 * compared against what went in, and a mismatch refuses the save instead of
 * writing it.
 *
 * The etag exists because this file is still edited by hand and by git. A save
 * carrying a stale etag means the file moved underneath the editor — a
 * checkout, a merge, another window — and overwriting it silently would throw
 * away whatever that was. Two `write()` calls on the SAME resolved path are a
 * different hazard — races within this process, not against git — and are
 * closed by a per-path queue rather than by the etag: see `writeQueues`.
 */

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ContentDataset } from "../content/schema/content-schema";
import { serializeDataset } from "./serialize";
import type { ValidationReport } from "./inspect";
import { inspectDataset } from "./inspect";

export const DATASET_FILE = "content/data/content.es.json";

/**
 * One queue per resolved file path, not per `DatasetStore` instance. Keying by
 * instance would leave two stores constructed over the same file each running
 * its own check-then-act window against the same disk file — exactly the
 * silent-loss race the queue exists to close, and `new DatasetStore()`
 * defaults to the relative `DATASET_FILE`, so a second instance over the same
 * path is one accidental construction away, not a contrived scenario. Keying
 * by the RESOLVED path means two different relative spellings of the same
 * file still collide on the same entry.
 */
const writeQueues = new Map<string, Promise<void>>();

/**
 * Line endings are normalized first, so the same content gives the same etag on
 * a Windows checkout (CRLF) and on CI (LF).
 */
export function etagOf(text: string): string {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex").slice(0, 16);
}

export interface DatasetSnapshot {
  data: ContentDataset;
  etag: string;
}

/** The dataset was refused. `report` is what the form renders. */
export class InvalidDatasetError extends Error {
  constructor(readonly report: ValidationReport) {
    super("The dataset was refused: it violates the schema or the contract rules.");
    this.name = "InvalidDatasetError";
  }
}

/** The file changed underneath the editor since the client read it. */
export class StaleEtagError extends Error {
  constructor(readonly currentEtag: string) {
    super("The file changed underneath the editor. Reload before saving.");
    this.name = "StaleEtagError";
  }
}

/** The serializer produced text that does not parse back to the input. */
export class SerializationError extends Error {
  constructor(cause: unknown) {
    super("The serializer changed the data. Nothing was written.");
    this.name = "SerializationError";
    this.cause = cause;
  }
}

export class DatasetStore {
  constructor(private readonly file: string = DATASET_FILE) {}

  /** Raw text plus its etag. No validation: used for the pre-write etag check. */
  private async readRaw(): Promise<{ raw: string; etag: string }> {
    const raw = (await readFile(this.file, "utf8")).replace(/\r\n/g, "\n");
    return { raw, etag: etagOf(raw) };
  }

  async read(): Promise<DatasetSnapshot> {
    const { raw, etag } = await this.readRaw();
    const parsed: unknown = JSON.parse(raw);
    const report = inspectDataset(parsed);
    if (!report.ok) throw new InvalidDatasetError(report);
    return { data: parsed as ContentDataset, etag };
  }

  /**
   * `write()` re-reads the current etag and only then renames — a classic
   * check-then-act — so two overlapping `write()` calls on the same resolved
   * path could both pass the check before either renames, and the second
   * rename would silently discard the first caller's edit. Chaining every
   * call onto `writeQueues`, keyed by path rather than by instance, makes
   * that window atomic WITHIN THIS PROCESS: the next call's check on that
   * path cannot start until the previous call's rename has already landed,
   * no matter which `DatasetStore` instance issued either call.
   *
   * It buys nothing against an external writer — a git checkout, a hand edit,
   * another process — because there is no promise chain to join there. That
   * case is, and has to remain, the etag comparison's job, not the queue's.
   */
  async write(input: unknown, expectedEtag: string): Promise<DatasetSnapshot> {
    const key = resolve(this.file);
    const queued = writeQueues.get(key) ?? Promise.resolve();
    // Queue this call behind whatever is already in flight on this path.
    const turn = queued.then(() => this.writeExclusive(input, expectedEtag));
    // The queue advances regardless of this call's outcome — a rejected write
    // must not jam every write after it — while `turn` still carries this
    // call's own result (or error) back to its caller. Installed
    // synchronously, in the same tick as the `get` above: `write()` has not
    // yet reached an `await`, so no other call to this path can interleave
    // between reading the old tail and installing the new one.
    writeQueues.set(
      key,
      turn.then(
        () => undefined,
        () => undefined,
      ),
    );
    return turn;
  }

  /**
   * The actual write, run with exclusive access to `file` within this
   * process, across every `DatasetStore` instance that resolves to the same
   * path (see `writeQueues`).
   */
  private async writeExclusive(input: unknown, expectedEtag: string): Promise<DatasetSnapshot> {
    const report = inspectDataset(input);
    if (!report.ok) throw new InvalidDatasetError(report);

    const data = input as ContentDataset;
    const serialized = serializeDataset(data);
    try {
      assert.deepStrictEqual(JSON.parse(serialized), data);
    } catch (err) {
      throw new SerializationError(err);
    }

    // Unique per CALL, not per process: a pid-based name is shared by every
    // write() in flight on this process, so two overlapping writes would
    // target the same tmp path and the loser's rename would fail with an
    // unrelated ENOENT instead of the StaleEtagError it should surface.
    const tmp = `${this.file}.tmp-${randomUUID()}`;
    try {
      // Written before the etag is (re-)checked, so the slow part of the
      // write — putting the bytes on disk — happens outside the
      // check-then-act window. What is left between the check and the
      // rename is just the rename itself.
      await writeFile(tmp, serialized, "utf8");
      const { etag: currentEtag } = await this.readRaw();
      if (currentEtag !== expectedEtag) throw new StaleEtagError(currentEtag);
      // Same directory, so the rename is atomic: a reader sees the old file
      // or the new one, never a half-written one.
      await rename(tmp, this.file);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }

    return { data, etag: etagOf(serialized) };
  }
}
