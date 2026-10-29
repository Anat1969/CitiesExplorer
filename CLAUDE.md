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
(project cities-explorer) from `main`: https://cities-explorer-navy.vercel.app

```bash
npm run build
npx vite preview --port 4173 & node tests/e2e.mjs   # Playwright, clicks every problem, case, filter and board action
```

Playwright comes from the global install: `ln -s "$(npm root -g)/playwright" node_modules/playwright`.
The test serves the A&I menu from `tests/fixtures/ai-menu.js` (copy of AppOfApp-GH `public/ai-menu.js`).

## Content

- `src/data/problems.ts`: 9 problems. Each has a planning question, a summary and "מהלכים שחוזרים" (the synthesis
  across cases, the core value of the app). Problem colors carry meaning: keep them.
- `src/data/cases.json` (types in `cases.ts`): 54 cases, 8 in Israel. Every case: Hebrew name + full original name (`nameEn`, Google-searchable), before,
  intervention, result, transferable moves, cautions (what failed or is disputed: mandatory, no case without it),
  Israel relevance, team, a parametric section (`before`/`after` bands), related apps, and for the tool:
  coordinates, `yearStart`, `climate`, `context`, `approach`, `cost` (1-3), `duration` (1-3), `moves` (ids from
  `moves.ts`), `sources` (URLs actually seen) and `facts` (each `verified` or `approx`, with its source).
- `src/data/moves.ts`: 40 planning moves (the pattern language), each with phase (quick/medium/long) and cost.
- Adding cases: research with web search, one JSON object per case in the same shape, then validate (ids of
  problems and moves, band types, sources, no decorative symbols) before merging into `cases.json`.
- Facts: every number and date was checked against web search results on 2026-10-24 (3 research agents).
  Where sources disagree the wording is approximate and the fact is marked "משוער". The case page shows
  "X מתוך Y עובדות אומתו מול מקור".
- The section drawing (`src/components/Section.tsx`) is schematic. "שטח החתך לרכב" is computed from the bands and
  labeled as a schematic estimate, not a measurement.
- Photos (`photos` in each case): 146 freely licensed photos from Wikimedia Commons for 52 cases (Favela-Bairro and
  Drachten have none usable). Hotlinked from upload.wikimedia.org in standard thumbnail widths only (500, 960, 1280,
  1920; other widths are refused), `hash` = first two hex digits of md5 of the file name. Every photo shows author,
  license and a link to its Commons page. Captions are Hebrew. File names were checked to exist via the Commons API;
  the images themselves were chosen from titles and descriptions (this environment is blocked by Wikimedia, 429).
- The case page also has a satellite view (Google Maps embed by coordinates, no key), Street View and "עוד תמונות"
  (Google Images search).
- Related apps (`src/data/apps.ts`): שכונה 360, פינוי בינוי, ביומימטיקה, סגנונות עיצוב פנים.

## The tool ("הפרויקט שלי", `src/lib/match.ts`)

- The planner enters problems (first = main), scale, climate, context, budget and draws the existing section.
- Score out of 100, shown per component: problem 40, climate 15, section similarity 15 (cosine of band
  profiles), scale 10, context 10, budget 10. Near climates and contexts get partial credit.
- Strategy: moves of the top 8 matches (score 45+), weighted by score, grouped by phase. A phase left with
  fewer than two moves is filled from all cases of the same problem and labeled "מתוך כל מקרי הבעיה".
- "כיוון אפשרי לחתך": the site's own section re-divided in the proportions of the best match's "after".
- Projects live in localStorage (`src/lib/projects.ts`), id in the address `?view=project&p=`.
- "מסמך פתרונות למהנדס" (`?view=doc&p=`, `DocPage.tsx`): photo of the problem (resized to 1280 JPEG, stored with the
  project), the chosen problems, the top solutions (score 35+) ranked by relevance with traffic-light blocks (what
  worked, what to check here, what failed), phases, recommendation. Every text is editable in place and kept in
  `site.doc`; printable to PDF.
- Method shown in the UI: precedent library + pattern language (Christopher Alexander). Not a recommendation.

## Views

home, problem, case, all, board, moves (problem x move matrix), move, map (a rotating orthographic globe, d3-geo +
world-atlas, lazy loaded; drag to turn; same-city points fan out in a ring; legend beside it; the timeline runs right to
left with a playhead that plays through the years and fades cases not yet started; a timeline click turns the globe
to the case), doc, project, compare (`?ids=a,b,c`),
present (`?view=present&s=`; keyboard arrows). Print stylesheet for project brief and board.

## UI rules

- A&I LOGO BUTTON: the top bar holds only the app name (links home), content navigation (בעיות, כל המקרים,
  לוח השראה), search, and ONE logo button `<ai-menu>` from https://appofapp-gh.vercel.app/ai-menu.js. Copy link,
  dev chat, install: only inside it. The e2e test fails without it.
- State lives in the address: `?problem=`, `?case=` (+ `problem=` for context), `?view=all|board`, `?scale=`, `?q=`.
- Board (`src/lib/board.ts`): saved cases + a note "מה לוקחים מכאן לפרויקט", localStorage, copied as a brief.
- Square buttons and chips, depth and shadows, never flat.
- Every clickable element lifts on hover and sinks on press (`:active`). The A&I menu closes on every page change.
- Board notes save as you type, with a "נשמר במכשיר" status.
- Board writes read storage fresh each time (a stale closure once kept only the last of three saves).

## Anat's standing rules (2026-10-29, apply to every app)

1. Traffic light: positive in green, conditional in amber, negative or failed in red, so the eye sees for and against.
2. Visual reading: important words in bold, insights in a yellow highlighter.
3. Management buttons (save, board, copy) are small and quiet; content leads. Every button whose role is not
   obvious from its label gets a short explanation (`title` plus clear wording).
4. Every map has a legend.
5. Places around the world: the country's flag next to the project name (flags are the exception to "no icons";
   SVG from `country-flag-icons`, never emoji, which Windows shows as letters).
6. A world map is a rotating globe (drag to turn); a timeline has a playhead that runs through the years.
7. Every case shows a real photo inside its frame, plus a link to a site with more photos.

## Deviations from anat-app-builder (said up front)

- No Supabase and no in-page editing: the content is curated in code and the board is personal (localStorage).
- Photos come from Wikimedia Commons under free licenses, with credit; the parametric section stays as the analysis.

## Hosting

- GitHub Pages: https://anat1969.github.io/CitiesExplorer/ , published by `.github/workflows/pages.yml` on every push
  to `main` (build with `BASE_PATH=/CitiesExplorer/`). Does not use the Vercel quota.
- Vercel: https://cities-explorer-navy.vercel.app , from `main`, base `/`.
- The app must work under any base path: links go through `BASE` in `src/lib/route.ts`, the service worker reads
  its scope, the manifest uses relative paths. The e2e test runs against both builds:
  `BASE_PATH=/CitiesExplorer/ npm run build && BASE_PATH=/CitiesExplorer/ npx vite preview --port 4174 &`
  then `BASE=http://localhost:4174/CitiesExplorer node tests/e2e.mjs`.

## Learned while building

- 2026-10-24: Vercel's free limit of 100 deployments a day ran out (across all of Anat's projects). Anat asked
  for a direct link through GitHub, so the app is also published on GitHub Pages.

- 2026-10-24: the repo was empty, so `main` was created from the first tested commit (nothing to merge yet).
  Later changes go through a branch, PR and merge to `main`.
- The GitHub default branch is still the work branch (it was pushed first), so the repo page shows that
  branch. Since PR #3 Vercel deploys it as preview only. Changing the default branch to `main` in GitHub
  settings makes the repo page show `main`.
- The direct link to the app is at the top of README.md. The repo's About > Website field cannot be set from
  this environment (no tool for it); Anat sets it once in GitHub.
- Vercel gave the project the address `cities-explorer-navy.vercel.app` (the plain name was taken). Read the
  real domain with `list_project_domains` before writing it anywhere.
- Full-page Playwright screenshots miss `whileInView` content and `background-attachment: fixed`: scroll the page
  before the shot, and keep the body background non-fixed.
- 2026-10-29: the flat map's case card covered Melbourne (bottom corner), so it could not be clicked. The card now
  sits beside the map, never over it.
- Wikimedia rate-limits this environment's shared IP (429, then "robot policy"). Query Commons through WebFetch
  (another egress) and never from curl in a loop.
- IBM Plex Mono has no Hebrew glyphs. Hebrew labels in mono fall back to Plex Sans Hebrew; keep their letter-spacing
  small (0.02-0.04em) or the words fall apart.
