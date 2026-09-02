/**
 * `pnpm run editor`. Binds the server to loopback and says where it is.
 *
 * Deliberately outside `src/pages/`: a route inside the site would need an SSR
 * adapter to accept a POST, would be built into `dist/`, and would force the
 * three checks that walk `dist/` to grow exceptions. See
 * `docs/superpowers/specs/2026-08-27-editor-design.md` §1.
 */

import { DatasetStore } from "../editor/store";
import { EDITOR_PORT, createEditorServer } from "../editor/server";

const store = new DatasetStore();
const server = createEditorServer(store);

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${EDITOR_PORT} is busy. Another editor is probably already running.`);
    process.exit(1);
  }
  throw err;
});

// Loopback only, and not by accident: this process writes to the dataset.
server.listen(EDITOR_PORT, "127.0.0.1", () => {
  console.log(`Editor on http://127.0.0.1:${EDITOR_PORT}/`);
});
