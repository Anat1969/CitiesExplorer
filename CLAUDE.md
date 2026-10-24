# CLAUDE.md

## Communication

- Always answer Anat in Hebrew. No icons or emoji, also not in the UI (no decorative arrows).
- Work by the end-to-end-builder skill. Merge every PR to `main` after green checks without asking: Anat gave standing approval.
- Delivery: final URL plus one line. Every correction Anat makes is added to this file.

## What this is

ערים מעוררות השראה (Cities Explorer): urban precedents (streets, squares, neighborhoods) organized by the
planning problem they solved. Action: השראה. Domain: תכנון עירוני (`urban`). Listed in the portfolio
https://appofapp-gh.vercel.app (Supabase cultura-GH, table `aoa_apps`, id `app-cities-explorer`).

## Stack

Vite + React 18 + TypeScript + framer-motion. Plain CSS (`src/styles.css`), Hebrew RTL, IBM Plex Sans Hebrew /
IBM Plex Mono. Static: no Supabase (content is curated in code, the board is personal). Deployed on Vercel
(project cities-explorer) from `main`.

```bash
npm run build
npx vite preview --port 4173 & node tests/e2e.mjs   # Playwright, clicks every problem, case, filter and board action
```

Playwright comes from the global install: `ln -s "$(npm root -g)/playwright" node_modules/playwright`.
The test serves the A&I menu from `tests/fixtures/ai-menu.js` (copy of AppOfApp-GH `public/ai-menu.js`).

## Content

- `src/data/problems.ts`: 9 problems. Each has a planning question, a summary and "מהלכים שחוזרים" (the synthesis
  across cases, the core value of the app). Problem colors carry meaning: keep them.
- `src/data/cases.ts`: 22 cases. Every case: Hebrew name + full original name (`nameEn`, Google-searchable), before,
  intervention, result, transferable moves, cautions (what failed or is disputed: mandatory, no case without it),
  Israel relevance, team, a parametric section (`before`/`after` bands) and related apps.
- Facts: numbers only when well known; otherwise approximate wording. Each case links to Google search for
  sources, and the footer says figures must be verified before official use.
- The section drawing (`src/components/Section.tsx`) is schematic. "שטח החתך לרכב" is computed from the bands and
  labeled as a schematic estimate, not a measurement.
- Related apps (`src/data/apps.ts`): שכונה 360, פינוי בינוי, ביומימטיקה, סגנונות עיצוב פנים.

## UI rules

- A&I LOGO BUTTON: the top bar holds only the app name (links home), content navigation (בעיות, כל המקרים,
  לוח השראה), search, and ONE logo button `<ai-menu>` from https://appofapp-gh.vercel.app/ai-menu.js. Copy link,
  dev chat, install: only inside it. The e2e test fails without it.
- State lives in the address: `?problem=`, `?case=` (+ `problem=` for context), `?view=all|board`, `?scale=`, `?q=`.
- Board (`src/lib/board.ts`): saved cases + a note "מה לוקחים מכאן לפרויקט", localStorage, copied as a brief.
- Square buttons and chips, depth and shadows, never flat.
