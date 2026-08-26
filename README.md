# Timetable & attendance

Class schedule and 80%-attendance tracker for the Aug–Oct 2026 term.

```bash
npm install
npm run dev
```

Open http://localhost:5173. It lands on today's date.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Attendance maths tests |
| `npm run build` | Production build to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run data` | Re-parse `data/timetable.xlsx` into `src/data/timetable.ts` |

`npm run data` needs Python with openpyxl:

```bash
pip install -r scripts/requirements.txt
```

## If the timetable changes

Replace `data/timetable.xlsx` and run `npm run data`. The parser validates that
every subject's session numbers run 1..N with no gaps and exits non-zero if the
sheet doesn't parse cleanly, so a broken import can't quietly become the app's
source of truth.

Note that attendance marks are keyed by `SUBJECT-GROUP-N`, so re-importing a
corrected sheet keeps existing marks aligned as long as session numbering is
stable.

See `CLAUDE.md` for architecture and `docs/project-doc.md` for the full spec.
