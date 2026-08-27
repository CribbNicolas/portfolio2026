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
 * away whatever that was.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";

import type { ContentDataset } from "../content/schema/content-schema";
import { serializeDataset } from "./serialize";
import type { ValidationReport } from "./inspect";
import { inspectDataset } from "./inspect";

export const DATASET_FILE = "content/data/content.es.json";

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

  async write(input: unknown, expectedEtag: string): Promise<DatasetSnapshot> {
    const report = inspectDataset(input);
    if (!report.ok) throw new InvalidDatasetError(report);

    const data = input as ContentDataset;
    const serialized = serializeDataset(data);
    try {
      assert.deepStrictEqual(JSON.parse(serialized), data);
    } catch (err) {
      throw new SerializationError(err);
    }

    const { etag: currentEtag } = await this.readRaw();
    if (currentEtag !== expectedEtag) throw new StaleEtagError(currentEtag);

    // Same directory, so the rename is atomic: a reader sees the old file or
    // the new one, never a half-written one.
    const tmp = `${this.file}.tmp-${process.pid}`;
    try {
      await writeFile(tmp, serialized, "utf8");
      await rename(tmp, this.file);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }

    return { data, etag: etagOf(serialized) };
  }
}
