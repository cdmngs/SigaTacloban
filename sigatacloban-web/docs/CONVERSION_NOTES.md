# Conversion parity notes

The HTML site follows the current React page structure and styling. Application API data remains empty by design; empty data is not replaced with demo records. “Yes” below means the page shell, primary layout, and intended empty/data states are represented; it is not a claim of pixel-identical rendering in every browser.

| React page | HTML page | Matches layout | Known gaps |
| --- | --- | --- | --- |
| `src/pages/Login.tsx` | `login.html` | Yes | Client-side sign-in is a prototype mock only. |
| `src/pages/Dashboard.tsx` | `dashboard.html` | Yes | Operational cards, charts, and rankings use empty mock data. |
| `src/pages/RiskMap.tsx` | `risk-map.html` | Yes | OSM tiles and Nominatim require network access; risk layers are empty. |
| `src/pages/Weather.tsx` | `weather.html` | Yes | Weather and forecast placeholders remain empty while mocks are enabled. |
| `src/pages/Trends.tsx` | `trends.html` | Yes | Trend series and ranking are empty. |
| `src/pages/WhatIf.tsx` | `what-if.html` | Yes | No areas are supplied by the mock API, so area-dependent simulation is unavailable in the UI. |
| `src/pages/MlEvaluation.tsx` | `ml-evaluation.html` | Yes | No model dataset or trained results are supplied. |
| `src/pages/Incidents.tsx` | `incidents.html` | Yes | Incident table and detail records are empty; record-dependent actions cannot be exercised without creating a record. |
| `src/pages/Coverage.tsx` | `coverage.html` | Yes | Station and underserved-area lists are empty. |
| `src/pages/Alerts.tsx` | `alerts.html` | Yes | Alert cards are empty; the page uses its intended all-caught-up state. |
| `src/pages/Reports.tsx` | `reports.html` | Yes | Preview sections have no operational data; local PDF export uses the empty preview. |
| `src/pages/Users.tsx` | `users.html` | Yes | The four fixed managed accounts are shown; mock account mutations are read-only. |
| `src/pages/StyleGuide.tsx` | `style-guide.html` | Partly | The showcase retains its explicit component examples; this is the documented exception to the no-sample-data rule. |
| `src/pages/Placeholder.tsx` (`Forbidden`) | `403.html` | Yes | Requires an authenticated session to reach through the app guard. |
| `src/pages/Placeholder.tsx` (`NotFound`) | `404.html` | Yes | Page is a static fallback; unknown URLs do not use React Router. |

## Phase 6 fixes

| Fix | Files changed |
| --- | --- |
| Styled the full-width primary “Update preview” action and changed the no-area report cover to a neutral “No data” state. | `assets/js/pages/reports.js`, `assets/css/pages.css` |
| Styled “Plan new station” as a full-width secondary action and replaced the underserved-area message with the shared empty state. | `assets/js/pages/coverage.js`, `assets/css/pages.css` |
| Corrected the “Current” preset, removed the no-area sample defaults, and disabled scenario controls until an area is available. | `assets/js/pages/what-if.js` |
| Displayed weather dashes when no valid update timestamp exists, capitalized the condition label, and show relative update time only for timestamped data. | `assets/js/pages/weather.js` |
| Repositioned gauge text clear of the arc-center pivot and omitted the needle when there is no score. | `assets/js/ui/gauge.js`, `assets/css/pages.css` |
| Applied the compact shared empty-state component to Dashboard, Trends, Coverage, and What-If empty cards and chart notes. | `assets/js/ui/empty-state.js`, `assets/js/pages/dashboard.js`, `assets/js/pages/trends.js`, `assets/js/pages/coverage.js`, `assets/js/pages/what-if.js`, `assets/css/pages.css` |
| Added the 138-name Tacloban barangay directory and reused it for the incident filter and required form select. | `assets/js/pages/incidents.js`, `assets/js/api/barangays.js` |
| Assigned distinct factor icons for Temperature, Low humidity, Low rainfall, Wind speed, and Station distance in the shared Risk DNA renderer. | `assets/js/ui/risk-dna-bars.js`, `assets/js/ui/icons.js` |

## Phase 5 verification performed

- `node --test tests/` passes all 9 logic and static-document tests; `node --check` passes all 74 application JavaScript files.
- Checked all 15 HTML routes at 390, 768, and 1440 px in a browser using the corresponding allowed role: no horizontal page overflow, `NaN`/`undefined` text, or captured console errors. The ML Evaluation page was checked as the analyst; other protected pages were checked with an allowed role. A separate 60-navigation role matrix confirmed allowed routes and forbidden-page redirects for all four roles. Login redirects to Dashboard when a session is already active.
- At 1440 × 900, Incidents and Coverage both fit without page scrolling and their map containers measured 846.4 × 692.4 px. OpenStreetMap tiles loaded on both.
- The Users page showed exactly four accounts and only one table/card layout at 390, 768, and 1440 px.
- The Add incident and Plan new station dialogs rendered over their maps with a full-viewport dim backdrop, scroll lock, focus containment, and Esc close; Plan new station also returned focus to its trigger.
- The Dashboard map and empty chart, plus the ML Evaluation empty chart, rendered without captured console errors. The chart canvases were present and no `NaN`/`undefined` text was found.
- Contrast checks found the original low-risk and high-risk chip text at 3.41:1 and 2.63:1 on white, respectively. Their foregrounds now use the existing success and strong-warning text tokens (7.03:1 and 6.26:1); the semantic green/orange indicator colors are unchanged. Other inspected muted, sidebar, and rusty-button text pairs passed.
- Leaflet, markercluster, Chart.js, jsPDF, and html2canvas are bundled under `assets/vendor`; map tiles loaded, and PDF export loads the local jsPDF/html2canvas files on demand.

## Remaining verification and integration gaps

- This browser pass checks responsive rendering, route access, overflow, empty-state text, and selected map/dialog behavior; it is not a pixel-by-pixel screenshot comparison of every React and HTML page at every role and viewport.
- PDF export was not completed end-to-end in this pass. It depends on the browser’s download behavior and should be confirmed in a manual Live Server session.
- The current repository has no backend implementation or authoritative API contract. [API_CONTRACT.md](./API_CONTRACT.md) documents the endpoint paths and payload conventions already used by the static API modules; confirm these with the backend before disabling mocks.
- OpenStreetMap, Nominatim, and Open-Meteo behavior depends on external network availability and their service policies.
- Empty mock lists prevent testing workflows that require an existing incident, alert, saved report, coverage station, or What-If area. No runtime sample records were added to fill these gaps.
- Browser font rasterization and third-party map tile timing can cause small visual differences from screenshots even where the page styles and structure are ported.
