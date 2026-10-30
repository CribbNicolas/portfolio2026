# portfolio2026

Nicolás Cribb's CV and portfolio, live at <https://cribbnicolas.pages.dev>
(Spanish) and <https://cribbnicolas.pages.dev/en/> (English).

One dataset (`content/data/`) is the single source of truth. A static Astro
site derives every surface from it: the landing, the CV pages the PDFs are
printed from, the PDFs themselves (rendered on demand by a Cloudflare Pages
Function), JSON-LD, `/cv.json` and `/llms.txt`. A CI pipeline validates the data
against its contract and checks every output before anything ships.

```bash
pnpm install      # pnpm only; Node >= 22.12
pnpm run dev
pnpm run editor   # local editor for the Spanish dataset
```

How the repo works and its rules: [`CLAUDE.md`](./CLAUDE.md). Pending work:
[`docs/TODO.md`](./docs/TODO.md).
