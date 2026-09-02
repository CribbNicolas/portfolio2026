# 08 — Branches and versioning

Decided 2026-08-25, when `develop` was added and the repo went public.

---

## 1. The four branches

```
feature/*  ──►  develop  ──►  staging  ──►  main
   |              |             |            |
  work        integration    preview      production
              no deploy      on Pages     cribbnicolas.pages.dev
              + bump         + smoke
```

| Branch | What it is | Deploys |
|---|---|---|
| `feature/*` | One change. Lives as long as it takes | No |
| `develop` | **Integration.** Collects PRs until publishing is worth it | **No** |
| `staging` | What is about to ship. A real preview, with the Function running | Yes, preview |
| `main` | What is published | Yes, production |

**Why `develop` exists.** Without it, every small PR fires a preview deploy: one
Cloudflare build and, as soon as somebody opens `/cv.pdf`, one Browser Rendering
render. The budget is not the real problem — at this volume there is plenty — but
the noise is: twenty deploys a week makes the deploy history stop saying
anything. `develop` accumulates, and `staging` publishes when there is something
worth looking at.

**`develop` does not deploy, and that has to be configured.** Cloudflare Pages,
with Preview deployments on "All non-Production branches", would deploy `develop`
and every feature branch — exactly what is being avoided. The correct config is
**Custom branches, including only `staging`**. See
[05](./05-deploy-and-analytics.md) §3.

**What runs on each.** `content-validation.yml` runs on all of them: the quality
gate does not depend on whether something gets published. What changes is the
rest:

| Workflow | When | Job |
|---|---|---|
| `content-validation.yml` | Every push and every PR | `validate` |
| `version-gate.yml` | PRs targeting `develop` only | `bump` |
| `flujo-de-ramas.yml` | PRs targeting `staging` or `main` only | `flujo` |
| `smoke-deploy.yml` | Every successful Pages deploy (i.e. `staging` and `main`) | — |

---

## 2. Nobody pushes directly to the three branches

Enforced with **GitHub rulesets**, not with local hooks.

A `pre-push` hook was evaluated and discarded: a hook runs on the machine of
whoever pushes, and the "Merge pull request" button runs on GitHub's servers. So
the hook covered the small case — an absent-minded push — and left the big one
open. Rulesets cover both, server-side, with nobody having to install anything.

**That is why the repo is public.** Rulesets are not available on private repos
on the Free plan; on public repos they work on every plan. That is the technical
reason for the change, and the reason the phone number left the dataset first
(see §3).

Configuration, one ruleset per branch:

| Branch | Rules |
|---|---|
| `main` | Require a pull request (0 approvals) · Status checks: `validate` + **`flujo`** · Block force pushes · Restrict deletions |
| `staging` | Same as `main`: `validate` + **`flujo`** |
| `develop` | Same, but with `validate` + **`bump`** instead of `flujo` |

### Where a PR can come from

Rulesets do **not** know where a pull request comes from: they look at the branch
being updated, not at the one contributing the commits. You can require a PR and
require checks, but not that the source is a specific branch.

That piece is supplied by `flujo-de-ramas.yml`: it fails if a PR into `main` does
not come from `staging`, or if one into `staging` does not come from `develop`.
Without it, nothing would stop opening a PR from `feature/whatever` straight into
`main` and skipping, in one move, the preview, the smoke over the published PDF
and the version bump.

It also rejects PRs coming from a fork. The repo is public, so anyone can fork it
and open a PR from a branch called `staging`: `head_ref` carries only the name,
and without comparing the source repository that PR would pass the filter by
being named the same.

**There is no hotfix escape hatch, on purpose.** An alternative path nobody uses
rots without anybody noticing. If going straight to `main` is ever necessary, the
check is disabled in the ruleset and re-enabled: two clicks, and it stays in the
repo's audit log.

**`Required approvals` at 0, not 1.** GitHub does not allow approving your own
PR. At 1, a one-person repo is stuck with no way out.

**`Require linear history`: no.** It forbids merge commits, and this repo's
history uses them.

---

## 3. `package.json` is the only source of truth for the version

**Reviewed 2026-08-25:** `package.json` is the repo's only version declaration.
There is no other in `content/`, `src/`, `scripts/` or `astro.config.mjs`, and
**nothing consumes it**: it is not in `/cv.json`, not in `/llms.txt`, not in a
`<meta>`. It is internal bookkeeping, on purpose.

**Why it is not exposed.** A version number in the output is a promise: that
somebody will be able to use it to decide something. Today there is nobody. When
there is — a dataset consumer wanting to know whether it changed, for example —
it gets added there and it gets said who it is for. Exposing it "just in case"
would be inventing a contract with no counterpart.

**If a second source ever appears**, the rule is that it derives from
`package.json` at build time, never that it is written by hand in two places. Two
hand-written numbers drift; the only question is when.

### The phone number, and why it is gone

The dataset carried a phone number with `publishPhoneOn: ["cv", "cv-short"]` —
declared for the designed CV and the one-page one, and filtered out of everything
else by rule 8. Neither of those surfaces is built yet, so it was not printed
anywhere.

When the repo went public, that number would have sat in plain text inside an
indexable JSON. The **value** was removed; the machinery is intact: the `phone?`
field is still in the schema, the filter is still in `resolveView`, and the rule
8 test now injects an obviously fake number and verifies the filter instead of
depending on the dataset carrying one. Loading a phone number tomorrow requires
no code change.

A second test anchors the decision: if someone puts a number back in the dataset,
it fails and explains that the repo is public and that this enters the git
history, from which it does not leave without rewriting it.

---

## 4. The version rises on entering `develop`

**The rule:** every PR targeting `develop` raises `package.json.version`. No
exceptions, and `version-gate.yml` enforces it.

**Why at `develop` and not later.** That is where each change enters, one at a
time. Versioning at `staging` would give a batch of six PRs a single number, and
the version would stop identifying which of the six broke something. The
`develop` → `staging` and `staging` → `main` PRs **do not touch the number
again: they carry it.** That way the version seen in production is exactly the
one verified in preview, and before that in integration.

**Why by hand and not automatically.** Choosing between patch, minor and major is
a semantic decision about what changed for whoever consumes the site, and a
machine looking at diffs cannot make it well. A bot that always bumps the patch
produces numbers that rise and mean nothing.

The alternatives were discarded for concrete reasons, not by taste:

- **A bot committing to the branch**: it needs a token with write access to a
  protected branch, and it leaves the branch with a commit the source does not
  have → a conflict on the next merge, every time.
- **Deriving it from conventional commits**: it makes versioning depend on commit
  messages always being correct. It trades one discipline problem for another,
  and adds a dependency.

**What raises what:**

| Jump | When |
|---|---|
| `patch` | A fix. Nothing new, nothing that reads differently |
| `minor` | Something new: a section, an endpoint, a datum that was not there |
| `major` | Something that already existed changes shape. A URL that goes away, a `/cv.json` field that gets renamed |

On a personal site, `major` will be rare. That is the point: when it happens, it
should be noticeable.

**What the gate verifies, exactly.** That the PR's version is **strictly
greater** than `develop`'s. That is hard and blocks.

It also classifies the jump and, if it is not a clean step — `0.1.0 → 0.3.0`,
`1.2.3 → 2.0.1` — says so **without blocking**. Skipping is sometimes on purpose,
but it is also the exact signature of a typo, and staying quiet would be worse
than over-warning.

### Stacked PRs, and the trap in them

Two PRs where the second is branched off the first work fine — open B against A,
and when A merges GitHub retargets B to `develop` on its own.

What does not work on its own is the gate. **That retarget fires the
`pull_request` event with action `edited`, which is not in GitHub's default
list** (`opened`, `synchronize`, `reopened`). Without `edited` declared,
`version-gate.yml` never runs for B — and `bump` is a required check, so the PR
sits `BLOCKED` waiting for something that will never arrive. It looks like a
hung check; it is a workflow that was never triggered.

It is fail-safe — nothing merges unverified — but the only way out was closing
and reopening the PR. `version-gate.yml` now declares
`types: [opened, synchronize, reopened, edited]`, so a retarget re-runs it.

Measured on PR #18, 2026-08-27.

**Running it before opening the PR:**

```bash
git fetch origin develop
pnpm run test:version
```

The pure logic is in `scripts/version.ts` and is tested in `pnpm test`
(`version.test.ts`), with no git repo needed around it. The check
(`version-bump.check.ts`) is only the layer that reads git and the file.

---

## 5. The flow, in order

1. Branch from `develop`. Work. PR **into `develop`**, **with the version bump in
   the same PR**. `content-validation.yml` and `version-gate.yml` run. Nothing
   deploys.
2. When what has accumulated is worth publishing: PR **`develop` → `staging`**,
   without touching the version.
3. On merge, Pages deploys the preview and `smoke-deploy.yml` runs `test:pdf`
   against the published `/cv.pdf`. Watch it pass.
4. PR **`staging` → `main`**. It does not touch the version either. On merge,
   production. The smoke runs again, now against production.

**The only step that can be forgotten is the bump in step 1**, and it is the only
one with a check of its own.
