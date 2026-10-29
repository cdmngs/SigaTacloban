# SigaTacloban API verification

## Scope and method

Verification covered the current mock-mode samples and API wrappers, shared data-state behavior, formatter/risk helpers, a browser smoke sweep of the static pages, and static inspection of page imports and shared-store subscriptions. The app remained in its checked-in `USE_MOCK: true` configuration.

The full requested scenario matrix was **not** completed. No large/empty/partial/failure sample set was swapped through every page, and there is no local FastAPI test server. `tools/ui-audit.js` is absent, so the requested UI audit could not be run. Results below distinguish completed checks from unrun scenarios rather than treating untested cases as passing.

## Page and endpoint matrix

Legend: All relative endpoint paths below are rooted at `/api/v1`. **Pass** means the named check ran successfully; **Not run** means there is no page-level result for that scenario. “Normal” includes the sample-envelope/API-wrapper tests and a browser smoke sweep; “empty,” “partial,” and “failure” only include shared-helper unit coverage, not page-by-page data injection.

| Page / surface | API endpoints used by the page | Normal | Large | Empty | Partial | Failure | Result and notes |
|---|---|---|---|---|---|---|---|
| Login | `POST /auth/login` | Pass | Not run | Not run | Not run | Not run | Browser sign-in succeeded in mock mode. Invalid credentials/network errors were not injected. |
| App shell / notification bell | `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout`, `GET /alerts`, `GET /risk/city`, `GET /weather/current` | Pass | Not run | Helper only | Formatter only | Helper only | Rendered in browser smoke sweep; acknowledgement, unread-badge and timer refresh behavior were not exercised end-to-end. |
| Dashboard | `GET /dashboard/summary`, `/risk/city`, `/risk/areas`, `/incidents`, `/stations`, `/weather/current` | Pass | Not run | Helper only | Formatter only | Helper only | Normal page smoke-tested. Dashboard subscribes to the incident refresh signal for its summary; map/KPI behavior was not verified with injected mutations. |
| Risk Map | `GET /barangays/boundaries`, `/risk/areas`, `/risk/forecast/{day}`, `/risk/hotspots`, `/risk/areas/{id}`, `/incidents`, `/stations`, `/weather/current`, `/geocoding/search` | Pass | Not run | Not run | Not run | Not run | Page shell and map controls rendered; no layer/prediction/selection scenario was injected. Geocoding is called through the API proxy, not directly from the page. |
| Weather | `GET /weather/analysis`, `/weather/forecast`, `/weather/risk-days`, `/weather/correlation`, `/risk/areas` | Pass | Not run | Helper only | Formatter only | Helper only | Page rendered with a weather-service error state during the browser sweep; saved-data fallback was not verified. |
| Trends | `GET /trends`, `/trends/barangays`, `/trends/export.csv`, `/risk/areas` | Pass | Not run | Helper only | Formatter only | Helper only | Normal page smoke-tested; filters/export and updates after incident mutations were not exercised. |
| What-If | `GET /whatif/areas`, `/risk/areas/{id}`, `/whatif/scenarios`; `POST /whatif/simulations`, `/whatif/scenarios`; `DELETE /whatif/scenarios/{id}` | Pass | Not run | Helper only | Formatter only | Helper only | Normal page smoke-tested; save/reload/delete and empty-area UI were not injected. |
| Incidents | `GET /incidents`, `/incidents/options`, `/incidents/{id}`, `/risk/areas`, `/geocoding/reverse`; `POST /incidents`; `PATCH /incidents/{id}`; `DELETE /incidents/{id}`; `GET /incidents/export.csv` | Pass | Not run | Helper only | Formatter only | Helper only | Normal page smoke-tested; the existing deterministic filter/sort/pagination and CSV unit tests pass. No 500-row rendering test or CRUD/map mutation was performed in this phase. |
| Coverage | `GET /coverage`, `/coverage/rings`, `/risk/areas`, `/incidents`, `/stations`; `POST /coverage/stations/plan` | Pass | Not run | Helper only | Formatter only | Helper only | Normal page smoke-tested; ring toggles and station simulation were not exercised. The current modal explicitly does not create a station. |
| Alerts | `GET /alerts`, `/alerts/rules`; `POST /alerts/{id}/acknowledge`, `/alerts/read`; `PUT /alerts/rules` | Pass | Not run | Helper only | Formatter only | Helper only | Normal page smoke-tested; acknowledgement, rule validation, notification badge and rule-boundary updates were not exercised end-to-end. |
| Reports | `GET /reports`, `/reports/{id}/download`, `/risk/areas`, `/weather/current`, `/coverage`, `/incidents`; `POST /reports/preview`, `/reports`; `DELETE /reports/{id}` | Pass | Not run | Helper only | Formatter only | Helper only | Normal page smoke-tested; preview debounce, generation, and download flows were not exercised. |
| Users | `GET /users`, `/roles/permissions`; `POST /users`; `PATCH /users/{id}`; `POST /users/{id}/activate`, `/deactivate`, `/password-reset`, `/invite`; `DELETE /users/{id}` | Pass | Not run | Helper only | Formatter only | Helper only | Normal page smoke-tested; user mutations and server-side permission errors were not injected. |
| ML Evaluation | `GET /models/evaluation`, `/models/datasets`; `POST /models/datasets`, `/models/retrain`, `/models/active`; `GET /models/jobs/{id}` | Role-blocked | Not run | Not run | Not run | Not run | Browser sweep used the Admin user, whose route policy denies this page; no Analyst-role browser run was performed. |
| Style Guide | None | Pass | N/A | N/A | N/A | N/A | Static presentation page; it intentionally contains example/demo values. |
| 403 | None | Pass | N/A | N/A | N/A | N/A | Static access-denied page rendered. |
| 404 | None | Pass | N/A | N/A | N/A | N/A | Static not-found page rendered. |

The automated checks included all API sample references/envelopes, representative mock reads from every data API module, formatter null/invalid-value behavior, risk boundaries and custom thresholds, data-state loading/success/empty/error/retry/cancellation, incident filter/sort/pagination and CSV quoting, shared-store notifications, and refresh-timer visibility behavior. `npm test` passes 22 tests.

## Live updates and live-mode status

| Requested update | Verification result | Evidence / limitation |
|---|---|---|
| Acknowledge alert updates alert row, tab counts, bell badge | Not verified end-to-end | The alert page updates its list and shared in-page notification state optimistically; no click-through browser assertion was made. |
| Save alert rules updates thresholds/chips/gauges | Not verified end-to-end | Threshold helper tests cover default and custom boundaries; no page interaction test was made. |
| Incident CRUD updates list, map, count, dashboard KPIs, trends | Wired; UI mutation flow not fully verified | The shared store now broadcasts permitted shared-state patches between tabs, and Trends subscribes to `incidentRefreshAt` as Dashboard does. The cross-tab transport has a passing unit test; CRUD-to-map/KPI/chart behavior was not browser-asserted. |
| Active ML model updates other model-name displays | Not verified | The ML page writes the active model to the in-memory store; no other page subscription or browser action was exercised. |
| Saved What-If scenario updates saved list | Not verified end-to-end | Save/list APIs are wired in the page; no mutation assertion was performed. |
| New station updates coverage score/rings | Not applicable to current UI | The page only calls the hypothetical coverage-plan endpoint and states that no station is created; it does not expose a confirmation/persistence action. |
| `USE_MOCK: false`, auth header and backend response parity | Not run | No backend or mocked live-fetch harness was available in this verification. The setting remains `true`; no claim is made that live requests were proven. |

## Contract shape and hard-coded data findings

- Every contract-linked JSON sample exists, parses, and has the documented success envelope; the shared error sample has the expected `error` fields. Representative mock reads from each data API module returned their expected UI-level array/object shapes. No sample/API shape mismatch was detected by these checks. This is not a full field-by-field response-schema test for every endpoint.
- Page modules do not import files from `assets/data/samples/` directly; sample selection is in the API layer.
- API wrapper methods unwrap `{data, meta}` before returning data to page modules. This is intentional UI adaptation, not a wire-contract discrepancy. Risk-level values are adapted between contract labels (`Very High`) and lowercase CSS keys (for example `veryhigh`).
- Hard-coded presentation/configuration remains in pages: incident fire-class/severity fallback options, What-If presets and slider labels/ranges, Risk Map layer labels and the eight timeline labels, and Style Guide demo statistics. Style Guide data is demonstrative; the incident fallbacks may mask a missing form-options endpoint response.
- No complete duplicate incident/alert API module was found in the page import paths; duplicate API implementations had been consolidated before this verification.

## Remaining problems and tool results

1. The requested page-by-page large, empty, partial, and failure injections remain untested. In particular, 500-incident rendering, server statuses 401/403/500, timeout handling in browser UI, and action-error field mapping still need automated coverage.
2. Cross-tab store transport and Trends incident-refresh subscription now exist and are unit-tested; the user-facing CRUD mutation flows still need browser assertions.
3. Live-mode parity and Authorization-header transmission remain unverified against a contract-payload server.
4. The browser reported invalid WOFF2 font decoding warnings during the smoke sweep. They do not appear related to the API/data-flow work and were not changed.
5. Coverage Plan New Station is simulation-only. Persisting a confirmed station would need an explicit confirmation flow and a create-station API call.
6. `node tools/ui-audit.js` failed because `tools/ui-audit.js` does not exist in this workspace.

| Command | Result |
|---|---|
| `npm test` | Pass — 23 tests, 0 failures |
| `node tools/ui-audit.js` | Not available — module not found |
