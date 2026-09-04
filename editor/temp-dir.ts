/**
 * Temp directories for editor tests, removed when THAT file's suite ends.
 *
 * A module-level `Set` shared across files would let one file's `after` delete
 * a directory another still-running file is reading — the reason this stayed
 * open. Each caller gets its own set and registers its own `after`.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TempDirs {
  dir(prefix?: string): Promise<string>;
  cleanup(): Promise<void>;
}

export function createTempDirs(): TempDirs {
  const pending = new Set<string>();
  return {
    async dir(prefix = "editor-"): Promise<string> {
      const dir = await mkdtemp(join(tmpdir(), prefix));
      pending.add(dir);
      return dir;
    },
    async cleanup(): Promise<void> {
      await Promise.all([...pending].map((d) => rm(d, { recursive: true, force: true })));
      pending.clear();
    },
  };
}
