/**
 * The checks every push runs, read from the workflow that runs them.
 *
 * The landing's "Cómo trabajo" panel lists them as proof. Typed by hand, the
 * list drifted the first time a step was added; read from
 * `.github/workflows/content-validation.yml`, the panel says what CI does by
 * construction. Order is the workflow's.
 *
 * Only `pnpm run <script>` and `pnpm test` steps count: installing, caching
 * and browser setup are plumbing, not checks.
 *
 * Build time only: it reads the file system, so it never reaches
 * `src/scripts/**`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const WORKFLOW = join(process.cwd(), ".github", "workflows", "content-validation.yml");

interface Workflow {
  jobs: Record<string, { steps?: { run?: string }[] }>;
}

/** The commands, as `package.json` names them: `typecheck`, `test`, `test:pdf`… */
export function ciSteps(file = WORKFLOW): string[] {
  const workflow = parse(readFileSync(file, "utf8")) as Workflow;
  const steps = Object.values(workflow.jobs).flatMap((job) => job.steps ?? []);
  return steps.flatMap((step) => {
    const run = step.run?.trim() ?? "";
    if (run === "pnpm test") return ["test"];
    const script = /^pnpm run ([\w:-]+)$/.exec(run);
    return script ? [script[1]] : [];
  });
}
