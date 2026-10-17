# SigaTacloban React-to-static conversion inventory

## Source reviewed and destination

The source of truth is the original React/Vite project at the workspace root. The new static site lives only in `sigatacloban-web/`; no existing source, public, docs, or configuration files were changed. Source review excluded `dist/` and `node_modules/`. There is no `src/features/` directory and no root `docs/CONVERSION_RULES.md`; both conversion documents are kept under this new site's `docs/` folder to comply with the instruction not to modify existing project content.

## Routes, pages, data, and role access

Role access is copied from `src/config/permissions.ts`. A route shown as "not allowed" is guarded and redirects to the authenticated 403 page. All fifteen application pages in the route inventory have been ported; unknown static paths use `404.html`.

| Route/page | React file | Purpose and components used | Data loaded | Roles allowed |
| --- | --- | --- | --- | --- |
| `/` | `index.html` entry in `src/App.tsx` | Redirect to Dashboard for a stored user or Sign in otherwise | Auth store only | All (redirect destination is guarded) |
| `/login` | `src/pages/Login.tsx` | Secure access form, logo, role preview, forgot-password toast, visual risk-map illustration | Managed account config; persisted mock session/remembered email | Signed-out users |
| `/dashboard` | `src/pages/Dashboard.tsx` | City risk summary; cards, risk gauge, weather, charts, map and recent incidents; `MapView`, `WeatherStat`, `ChartCard`, shared UI | Risk areas, incident totals/records, monthly incidents, stations, current weather | Admin, Prevention, Operations, Analyst |
| `/risk-map` | `src/pages/RiskMap.tsx` | Interactive risk and hotspot map, layer/mode controls, selected-area details; `MapView`, `MapSidePanel`, `MapModeControl` | Risk areas, incidents, stations, weather; Nominatim search | Admin, Prevention, Operations |
| `/weather` | `src/pages/Weather.tsx` | Weather conditions, risk days and correlation; `WeatherStat`, `ChartCard`, shared cards | Current weather, forecast/analysis, risk days, weather correlation, risk areas | Admin, Prevention, Analyst |
| `/trends` | `src/pages/Trends.tsx` | Trends and barangay ranking with period controls and CSV export; charts/table | Trend series and risk areas | Admin, Prevention, Analyst |
| `/what-if` | `src/pages/WhatIf.tsx` | Weather-condition scenario simulation and risk factors/result; sliders and gauge | What-if areas; local scenario/store state; `simulateRisk` | Admin, Prevention |
| `/ml-evaluation` | `src/pages/MlEvaluation.tsx` | Model evaluation/comparison and dataset-upload workflow; charts and dialogs | Model-evaluation service (empty fixture in both current mock branches); local upload/evaluation state | Analyst only (Admin is not permitted) |
| `/incidents` | `src/pages/Incidents.tsx` | Filtered, sorted and paginated incident archive with view/create/edit/delete/export actions and map | Incident records, coverage, risk areas, stations; phase-4 store | Admin, Operations, Analyst |
| `/coverage` | `src/pages/Coverage.tsx` | Response-station coverage, underserved places and station planning; map, mode control and side cards | Coverage, incidents and risk areas; planning service | Admin, Prevention, Operations |
| `/alerts` | `src/pages/Alerts.tsx` | Alert list/read/acknowledgement and configurable alert rules | Operational alerts and alert rules; phase-4 store | Admin, Prevention, Operations |
| `/reports` | `src/pages/Reports.tsx` | Report configuration, preview, history and PDF export | Risk, weather, coverage, incidents and saved reports | Admin, Prevention, Analyst |
| `/users` | `src/pages/Users.tsx` | Managed-user search, invitations, role/status changes and account actions | Managed users from phase-4 store/API | Admin |
| `/style-guide` | `src/pages/StyleGuide.tsx` | Brand palette and interactive showcase of typography, buttons, chips, icons, gauge, Risk DNA, stats/table, form controls, feedback and dialogs | No application/API query; hardcoded design-system examples | Admin |
| `/403` | `src/pages/Placeholder.tsx` (`Forbidden`) | Access-denied message and dashboard action inside the authenticated shell | Current user role | Any authenticated user |
| Unknown route / `/404` | `src/pages/Placeholder.tsx` (`NotFound`) | Not-found message and dashboard action; app redirects signed-out users to login | Auth store only | Any authenticated user |

The rule's four accounts and all four role route lists match `src/config/users.ts`, `src/config/permissions.ts`, and `src/store/auth.ts`. The admin route list intentionally does **not** include `/ml-evaluation`; that page is allowed for Analyst only. The shell's menu is role-filtered, but the static page guard also checks each direct page request.

## Shared components, hooks, and stores

| React file / export | Current responsibility | Static replacement |
| --- | --- | --- |
| `src/components/Logo.tsx` — `Logo` | Public logo and wordmark lockup | `assets/img/logo.png`; shell/login markup and `assets/js/ui/logo.js` |
| `src/components/ui.tsx` — `Button`, `Card`, `RiskChip`, `StatCard`, `Toggle`, `Slider`, `Modal`, `Drawer`, `BottomSheet`, `ToastProvider`, `useToast`, `DataTable`, `EmptyState`, `Skeleton`, `RiskGauge`, `RiskDnaBars`, `FilterBar`, `ConfirmDialog` | Shared controls, data displays, overlays, feedback and loading/empty states | `assets/js/ui/button.js`, `card.js`, `risk-chip.js`, `toggle.js`, `slider.js`, `overlays.js`, `modal.js`, `drawer.js`, `bottom-sheet.js`, `confirm.js`, `toast.js`, `table.js`, `empty-state.js`, `skeleton.js`, `gauge.js`, `risk-dna-bars.js`; CSS in `components.css`, `overlays.css`, `pages.css` |
| `src/components/QueryState.tsx` — query/skeleton/error states | Loading, retryable fetch failure and dashboard skeleton | `assets/js/ui/query-state.js` in the page-conversion phase; preserve loading/error distinction |
| `src/components/AppErrorBoundary.tsx` — `AppErrorBoundary` | Logs React render failures and shows reload action | `assets/js/ui/app-error.js` when application error states are ported; CSS folded into `components.css` |
| `src/components/WeatherStat.tsx` | Compact weather statistic | `assets/js/ui/weather-stat.js` and `assets/css/components.css` |
| `src/components/charts/ChartCard.tsx`, `chartConfig.ts` | Chart frame and shared Chart.js configuration | `assets/js/charts/theme.js` (Chart.js theme, empty chart and chart-card wrapper) |
| `src/components/map/MapView.tsx`, `MapModeControl.tsx`, `MapSidePanel.tsx`, `leafletIcons.ts` | Leaflet map, icon definitions, map mode/layer controls and selected-area panel | `assets/js/maps/map-view.js`, `layers.js`, `picker.js`; `assets/js/ui/map-mode-control.js`, `map-side-panel.js`; `assets/css/maps.css` |
| `src/hooks/useCountUp.ts` | Animated count-up display | `assets/js/utils/count-up.js` |
| `src/hooks/useMediaQuery.ts` | Reactive viewport/media-query state | `assets/js/utils/media-query.js` (or `matchMedia` listeners) |
| `src/hooks/useNominatimSearch.ts` | Debounced/cancellable place search | `assets/js/utils/nominatim-search.js`; `assets/js/api/nominatim.js` |
| `src/hooks/useTanglawQueries.ts` | TanStack Query wrappers for baseline risk/weather/incident/station/alert resources | Corresponding `assets/js/api/` services with `assets/js/utils/query.js` |
| `src/hooks/usePhase3Queries.ts` | TanStack Query wrappers for trends, what-if and model evaluation | `assets/js/api/trends.js`, `whatif.js`, `models.js` with `assets/js/utils/query.js` |
| `src/hooks/usePhase4Queries.ts` | Phase-4 incident/coverage/alerts/report query hooks | Corresponding `assets/js/api/` services with `assets/js/utils/query.js` |
| `src/hooks/usePhase4bQueries.ts` | User/phase-4b query hooks | `assets/js/api/users.js` with `assets/js/utils/query.js` |
| `src/store/auth.ts` | Persisted user/token, sign-in/out and role switch | `assets/js/core/auth.js`; mock persistence uses the existing `sigatacloban-session` key |
| `src/store/phase3.ts` | Persisted What-If scenarios and model/upload state | `assets/js/core/store.js` plus page-specific store module |
| `src/store/phase4.ts` | Persisted incident/alert/rule/report/user state | `assets/js/core/store.js` plus page-specific store module |

The static core includes `assets/js/app.js`, `assets/js/core/layout.js`, `auth.js`, `permissions.js`, `router.js`, and `store.js`. API services are under `assets/js/api/`, maps under `assets/js/maps/`, Chart.js helpers under `assets/js/charts/`, and plain-JavaScript helpers under `assets/js/utils/`. The temporary `dev-components.html` page and its page-only assets were removed during Phase 5.

## File-by-file source inventory

| Source | Contents / conversion destination |
| --- | --- |
| `package.json` | React/Vite/TypeScript/Tailwind build scripts, runtime dependencies and development/testing dependencies; no dependencies are required by the static site |
| `index.html`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js` | Vite entry, Vitest/Vite config and Tailwind/PostCSS theme; `tokens.css` and static document shells replace runtime/build configuration |
| `src/main.tsx`, `src/App.tsx`, `src/theme.ts`, `src/vite-env.d.ts` | React mount/providers/router/metadata, page routing, design token constants and Vite env declarations |
| `src/styles.css`, `src/components.css`, `src/overlay-layers.css`, `src/styles.app-error.css` | Base/shell/theme/component/layer and application-error styling; base CSS was copied with only the three Tailwind directives removed, overlay CSS copied, error styles folded into components CSS |
| `src/api/alerts.ts` | `fetchAlerts()` service |
| `src/api/alertsPartA.ts` | List/acknowledge/mark-read/rules/save/push mock alert functions |
| `src/api/client.ts` | Axios base client and auth header interceptor |
| `src/api/coverage.ts` | `getCoverage()` and `planCoverageStation(lat, lng)` |
| `src/api/incidents.ts`, `incidentsPartA.ts` | Incident fetch plus list/get/create/update/delete, empty filter defaults, paging/sort/filter operations |
| `src/api/mockDelay.ts` | Mock latency utility |
| `src/api/models.ts` | `fetchModelEvaluation()`; currently returns empty model evaluation data for mock and non-mock paths |
| `src/api/nominatim.ts` | Nominatim place search (`nominatimSearch(query, signal?)`) |
| `src/api/reports.ts` | List/create/delete/duplicate report operations |
| `src/api/risk.ts` | Risk-area, day-specific risk and monthly-incident retrieval |
| `src/api/stations.ts` | Fire-station retrieval |
| `src/api/trends.ts` | Period-specific trend retrieval |
| `src/api/users.ts` | List/add/update/delete/reset/resend managed-user operations |
| `src/api/weather.ts`, `weatherAnalysis.ts` | Current weather/forecast and weather-analysis/risk-days/correlation services |
| `src/api/whatif.ts` | What-if area fetch, risk simulation and screenshot-scenario check |
| `src/components/AppErrorBoundary.tsx`, `Logo.tsx`, `QueryState.tsx`, `WeatherStat.tsx`, `ui.tsx` | Global error, brand, query-state, weather-stat and shared primitive components |
| `src/components/charts/ChartCard.tsx`, `chartConfig.ts` | Reusable Chart.js container and configuration |
| `src/components/map/MapModeControl.tsx`, `MapSidePanel.tsx`, `MapView.tsx`, `leafletIcons.ts` | Map UI and Leaflet integration |
| `src/components/weather-stat.css`, `src/components/map/map-mode-control.css`, `map-side-panel.css`, `markers.css` | CSS for those component groups |
| `src/config/permissions.ts`, `reports.ts`, `users.ts` | Roles/routes/capabilities, report configuration and four managed accounts |
| `src/hooks/useCountUp.ts`, `useMediaQuery.ts`, `useNominatimSearch.ts`, `usePhase3Queries.ts`, `usePhase4Queries.ts`, `usePhase4bQueries.ts`, `useTanglawQueries.ts` | Count animation, viewport/place-search helpers and query wrappers |
| `src/layouts/AppShell.tsx`, `layout-overrides.css`, `phase2.css` | Role-filtered shell/navigation/profile/notifications and shell/map layout rules |
| `src/mocks/phase3.ts`, `phase4.ts`, `phase4b.ts`, `tacloban.ts` | Phase-specific and Tacloban fixture data; mostly empty-shaped lists/data for application pages |
| `src/pages/Alerts.tsx`, `Coverage.tsx`, `Dashboard.tsx`, `Incidents.tsx`, `Login.tsx`, `MlEvaluation.tsx`, `Placeholder.tsx`, `Reports.tsx`, `RiskMap.tsx`, `StyleGuide.tsx`, `Trends.tsx`, `Users.tsx`, `Weather.tsx`, `WhatIf.tsx` | The route/page modules listed above |
| `src/pages/alerts.css`, `coverage.css`, `dashboard-responsive.css`, `dashboard.css`, `incidents.css`, `ml-evaluation.css`, `phase3-pages.css`, `phase3-responsive.css`, `phase4-pages.css`, `reports.css`, `risk-map-responsive.css`, `risk-map.css`, `trends.css`, `users.css`, `weather.css`, `whatif.css` | Current React page styling; ported into the corresponding static page stylesheets, then preserved for Phase 5 parity adjustments |
| `src/store/auth.ts`, `phase3.ts`, `phase4.ts` | Persisted auth, scenario/model, operational phase-4 state |
| `src/test/setup.ts`, `src/test/ui.test.tsx` | Vitest/JSDOM and Testing Library setup/shared UI tests; browser-based static-site tests are separate work |
| `src/types/index.ts`, `phase2.ts`, `phase3.ts`, `phase4.ts`, `phase4b.ts` | Shared domain and API/UI TypeScript contracts; JS replacements will require runtime guards/JSDoc where validation is needed |
| `src/utils/downloadCsv.ts` | Browser CSV download helper; `assets/js/utils/download-csv.js` |
| `public/` | `logo.png` is copied unchanged to `assets/img/logo.png`; other current files are `apple-touch-icon.png`, `favicon-32.png`, `favicon-48.png`, `favicon.svg`, `icon-192.png`, `icon-512.png`, `manifest.webmanifest` |
| `docs/design/` | Current screenshots: `alerts.png`, `coverage.png`, `coverage_modal.png`, `dashboard.png`, `incidents.png`, `incidents_modal.png`, `login.png`, `ml-evaluation.png`, `reports.png`, `risk-map.png`, `risk-map_below.png`, `style-guide.png`, `style-guide_2.png`, `style-guide_3.png`, `style-guide_4.png`, `trends.png`, `users.png`, `users_below.png`, `weather.png`, `what-if.png` |

## Current design tokens

Sources: `tailwind.config.ts`, `src/theme.ts`, and root/CSS variables in `src/styles.css`.

| Token family | Shades (100–900) and DEFAULT |
| --- | --- |
| Coffee bean | 100 `#070200`, 200 `#0E0400`, 300 `#150601`, 400 `#1C0801`, 500/DEFAULT `#220901`, 600 `#7F2304`, 700 `#DB3C07`, 800 `#F97447`, 900 `#FCB9A3` |
| Dark garnet | 100 `#140502`, 200 `#280903`, 300 `#3B0E05`, 400 `#4F1306`, 500/DEFAULT `#621708`, 600 `#AE290E`, 700 `#ED421F`, 800 `#F3816A`, 900 `#F9C0B4` |
| Oxblood | 100 `#1D0602`, 200 `#3A0B05`, 300 `#581107`, 400 `#751609`, 500/DEFAULT `#941B0C`, 600 `#D32811`, 700 `#EF513C`, 800 `#F48B7D`, 900 `#FAC5BE` |
| Rusty spice | 100 `#250B02`, 200 `#4A1603`, 300 `#702105`, 400 `#952C06`, 500/DEFAULT `#BC3908`, 600 `#F54A0C`, 700 `#F77749`, 800 `#FAA586`, 900 `#FCD2C2` |
| Orange | 100 `#352302`, 200 `#6A4604`, 300 `#9F6907`, 400 `#D48D09`, 500/DEFAULT `#F6AA1C`, 600 `#F7BB4B`, 700 `#F9CC78`, 800 `#FBDDA5`, 900 `#FDEED2` |

Semantic values: brand primary `#220901`, primary hover `#1C0801`, dark garnet contrast `#4F1306`, accent `#BC3908`, accent hover `#952C06`, danger/oxblood `#941B0C`, info `#F6AA1C` with text `#220901`, success `#1F653D`, warning `#775A00`, strong warning `#9A4A00`, canvas `#FBF7F3`, surface `#FFFFFF`, tint `#F6EFEA`, border/chart grid `#EADFD8`, primary text `#220901`, secondary/chart `#7F2304`, muted text `#6E5B52`. Risk severity remains separate: low `#2E9E5B`, moderate `#F4C430`, high `#F77F00`, very high `#D62828`.

Typography: Poppins headings (400, 500, 600) and Inter body (400, 500, 600, 700). Card shadow: `0 8px 24px rgba(34,9,1,.08)`. Core radii: map control 6px, buttons/inputs generally 8px, card/surface 12px (some operational surfaces 16px), modal/app-error card 14–16px, chips 999px. Main desktop shell: 200px fixed sidebar, 64px top bar; content max width 1400px, page inline padding 20px, map block padding 12px, common layout gap 12px, operational map side column 340px. Focus-visible outline is 3px solid accent with 2px offset. The z-index scale is map 0 (map wrappers isolate stacking), top bar 30, navigation/sidebar 40, map-floating 500, drawer/sheet 1100, modal 1200, toast 1300; CSS also uses content 1 and illustration 2 within local stacking contexts.

## Runtime libraries and no-build loading

Current runtime libraries from `package.json` include React/React DOM, React Router, TanStack Query, Zustand, Axios, React Hook Form, resolvers/Zod, Chart.js and its React wrapper, Leaflet/React Leaflet/markercluster, lucide-react, jsPDF, plus Inter/Poppins. Build/test tooling includes Vite, TypeScript, Tailwind/PostCSS, Vitest/JSDOM and Testing Library. The static site does not execute React, Vite, Tailwind, TypeScript, or those dev dependencies.

The local distributions present in `assets/vendor/` are:

* Leaflet: `leaflet.css` and `leaflet.js`; its `images/` directory is alongside its stylesheet. Load stylesheet first, then the classic script before map modules.
* Leaflet.markercluster: `MarkerCluster.css`, `MarkerCluster.Default.css`, `leaflet.markercluster.js`; load after Leaflet.
* Chart.js: `chart.umd.js`; load as a classic script before a chart module (global `Chart`).
* jsPDF: `jspdf.umd.min.js`; load as a classic script before report/export code (UMD browser global).
* html2canvas: `html2canvas.min.js`; load as a classic script only where report capture needs it.
* Inter and Poppins: local Latin WOFF2 files under `assets/fonts/`, declared with `@font-face` in `tokens.css`.

No runtime CDN is needed for these packages. Nominatim search and OpenStreetMap tiles in the React source are remote services; they are not bundled JavaScript packages, and their use requires network access. `lucide-react` is not carried into the static site; shared static SVG/glyph assets or inline SVG are the no-build equivalent.

## Findings that conflict with or need interpretation against the conversion rules

1. `src/pages/StyleGuide.tsx` currently hardcodes showcase data: two named barangay rows with scores 82/78, stat examples 248/9, a risk gauge at 82, and six factor percentages. This is a literal exception to Rule 4's "No sample data" language, while the requested Style Guide and supplied screenshots include those examples. Phase 1 preserves the showcase as component documentation; later phases should treat the conflict as requiring clarification if Rule 4 is intended to prohibit even design-system examples.
2. The current `MapView` requests OpenStreetMap tiles, whose cartographic basemap contains roads and place labels. The React page has map layer controls for application overlays, but removing all road/place detail would require changing/removing the existing basemap and would alter current visual behavior (Rule 1). Rule 3 is unambiguous about removed feature overlays but can be read as removing all basemap geography; this distinction is flagged rather than assumed.
3. The current source includes a `/ml-evaluation` route and feature. It is allowed to Analyst only; the rule list of removed features does not name model evaluation, and it remains in the route inventory.
4. The React login is a local mock with the same four users and six-character password minimum; passwords are not authenticated remotely. This matches Rule 10, but a production login must not be inferred from the demo.
5. The source contains screenshots but no authoritative list identifying which visual defects are intentional. Therefore "preserve current visual bugs" means port the current rendered behavior and screenshots as supplied; no defects have been classified or corrected in Phase 1.
6. No `docs/API_CONTRACT.md` exists in the source workspace. Static API services use conventional REST-style endpoints alongside the mock responses; reconcile those real-fetch URLs and payloads when the backend contract becomes available. The source also has no complete barangay directory, so the Nominatim fallback list is limited to barangay names present in the React risk-area fixtures.
