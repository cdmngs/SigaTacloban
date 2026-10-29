# SigaTacloban API audit

**Scope.** Read-only audit of `sigatacloban-web`; the only permitted project-file creation for this task is this report. Page modules are in `assets/js/pages/` (not a top-level `pages/` directory). The app sets `USE_MOCKS = true` and `API_BASE_URL = "/api"` in `assets/js/api/config.js`; existing request paths are not versioned and do not match the requested `/api/v1/...` convention. Endpoint paths below are the recommended backend contract, not claims that a FastAPI service already exists.

**Status meanings:** **Available (mock)** = a matching module/function and mock path exist, though the mock may be empty; **Partial** = a stub, client-only implementation, incomplete mock, or unconnected UI exists; **Missing** = no usable implementation was found.

## 1. Required API endpoint inventory

Request/response fields are the fields currently consumed or sent by the frontend. `?` means the contract is not established by working data; `null` means the UI explicitly tolerates or displays no value. Roles are the frontend's role codes (`admin`, `prevention`, `operations`, `analyst`); backend authorization must be authoritative.

| Method | Path | Purpose | Pages | Request fields | Response fields | Suggested roles | Status |
|---|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | Authenticate credentials and issue JWT/access + refresh tokens | login | `email`, `password` | `accessToken`, `refreshToken`, `user{id,name,email,role,stationUnit}` | Public | Missing; local mock accepts any password length >= 6 |
| POST | `/api/v1/auth/logout` | Revoke/expire refresh token | all authenticated | refresh token or session | 204 | Authenticated | Missing; sign-out only removes localStorage |
| GET | `/api/v1/auth/me` | Resolve current authenticated user | all authenticated | bearer token | `id,name,email,role,stationUnit` | Authenticated | Missing; user comes from a four-entry client constant |
| POST | `/api/v1/auth/refresh` | Rotate JWT/refresh token | all authenticated | refresh token | new token pair | Authenticated | Missing |
| GET | `/api/v1/users` | Search/list user accounts | users | optional `q`, `role`, `active`, `page`, `pageSize` | `{rows:[{id,name,email,role,stationUnit,lastActive,active,pendingInvite}],total}` | admin | Available (mock); fixed four accounts |
| POST | `/api/v1/users` | Create user/invite | users | `name,email,role,stationUnit,active` | user record + invite status | admin | Partial; function exists, mock deliberately rejects writes |
| PATCH | `/api/v1/users/{id}` | Edit profile, role, activation status | users | partial `name,role,stationUnit,active,pendingInvite` | updated user record | admin | Partial; mock deliberately rejects writes |
| POST | `/api/v1/users/{id}/activate` | Activate account | users | — | updated `active` state | admin | Partial; current UI uses PATCH `active:true`, mock rejects |
| POST | `/api/v1/users/{id}/deactivate` | Deactivate account | users | — | updated `active` state | admin | Partial; current UI uses PATCH `active:false`, mock rejects |
| DELETE | `/api/v1/users/{id}` | Delete account | users | — | 204 | admin | Partial; mock is fixed/read-only |
| POST | `/api/v1/users/{id}/password-reset` | Send password reset | users | — | request status | admin | Partial; mock only returns the ID |
| POST | `/api/v1/users/{id}/invite` | Resend invite | users | — | invite status | admin | Partial; mock only returns the ID |
| GET | `/api/v1/roles/permissions` | Read role-permission matrix | users | — | roles and capability matrix | admin | Partial; matrix is hard-coded in `core/permissions.js` |
| GET | `/api/v1/barangays` | List barangay identifiers/names and optional centers | dashboard, risk-map, incidents, coverage, weather, trends, reports, what-if | optional search | `[{id,name,center:[lat,lng]?}]` | authenticated; scope by page | Missing; names are a static client array |
| GET | `/api/v1/barangays/boundaries` | City barangay boundary GeoJSON | risk-map, dashboard, coverage, reports | optional `barangayId` | FeatureCollection; feature `id/name/geometry` | authenticated; scope by page | Missing; risk area API currently returns `[]` |
| GET | `/api/v1/stations` | List fire stations | dashboard, risk-map, coverage | optional `operational` | `[{id,name,lat,lng,address?,barangay?,operational,coverageRadiusMeters?}]` | authenticated map/operations roles | Available (mock); always `[]` |
| POST | `/api/v1/stations` | Add station | admin/operations UI (not currently present) | `name,lat,lng,address?,barangay?,coverageRadiusMeters?` | station record | admin | Missing |
| PATCH | `/api/v1/stations/{id}` | Update station | admin/operations UI (not currently present) | partial station fields | station record | admin | Missing |
| GET | `/api/v1/incidents` | Filter, sort, and paginate incident archive | incidents, reports | `search,barangay,from,to,fireClass,severity,page,pageSize,sort,direction` | `{rows,total,page,pageSize}`; rows include `id,areaId,barangay,date,time,fireClass,class,severity,severityLabel,cause,responseMinutes,notes,lat,lng,status` | admin, operations, analyst | Partial; filter/pagination mock exists but starts empty; separate `fetchIncidents()` returns a plain array |
| GET | `/api/v1/incidents/{id}` | Read incident detail | incidents | path `id` | incident record above | admin, operations, analyst | Partial; helper exists, empty mock |
| POST | `/api/v1/incidents` | Create incident | incidents | `barangay,areaId,fireClass,class,severity,severityLabel,date,time,cause,responseMinutes,notes,lat,lng` | created incident record | admin, operations | Partial; in-memory mock works, but no seed records/persistence |
| PATCH | `/api/v1/incidents/{id}` | Edit incident | incidents | partial incident fields | updated incident record | admin, operations | Partial; in-memory mock works |
| DELETE | `/api/v1/incidents/{id}` | Delete incident | incidents | path `id` | 204 | admin, operations | Partial; in-memory mock works |
| GET | `/api/v1/incidents/export.csv` | Export filtered incident rows | incidents | same filters as list | `text/csv` | admin, operations, analyst | Partial; CSV currently generated in browser from currently loaded rows |
| GET | `/api/v1/incidents/monthly` | Monthly incident counts | dashboard | optional `year` | `[{year,month,count}]` | authenticated | Partial; function exists but mock returns `[]` |
| GET | `/api/v1/risk/city` | Current city risk score/class and horizon | dashboard, risk-map, reports | optional `asOf` | `{score,level,asOf,horizonHours}` | authenticated | Missing; dashboard approximates city score with top area |
| GET | `/api/v1/risk/areas` | Barangay risk zones and hotspot data | dashboard, risk-map, weather, trends, incidents, coverage, reports, what-if | optional `day` | `[{id,name,score,level,trend,center:[lat,lng],geometry,factors:[{label,value}],explanation,areaKm2,nearestStation:{name,distanceKm,responseMinutes},currentConditions:{temperatureC,humidityPercent,rainfallMm,windKph},whatIfBaseline}]` | authenticated; scope by page | Partial; function exists, mock returns `[]` |
| GET | `/api/v1/risk/forecast/{day}` | Forecast/timeline risk areas for day 0–7 | risk-map | `day` integer | same area shape with forecast score/level | admin, prevention, operations | Partial; mock ignores day and returns `[]` |
| GET | `/api/v1/risk/hotspots` | Explicit hotspot layer/centers | risk-map | optional `day`, `limit` | `[{id,lat,lng,score,areaId?}]` | admin, prevention, operations | Partial; currently derived from area centers in the browser |
| GET | `/api/v1/risk/areas/{id}` | Selected-area detail and explanation | risk-map, what-if, reports | path `id`, optional `day` | area fields above, including factors, explanation, weather, nearest station | authenticated; scope by page | Missing as a detail endpoint; UI assumes all detail is embedded in the area list |
| GET | `/api/v1/weather/current` | Current observed conditions | dashboard, risk-map, weather, reports | optional location | `temperatureC,feelsLikeC,humidityPercent,rainfallMm,windKph,windDirection,pressureHpa,condition,updatedAt` | authenticated | Partial; `weather.js` returns `null`; analysis module has an Open-Meteo fetch but mock returns zero-valued data |
| GET | `/api/v1/weather/forecast` | Seven-day daily forecast | weather | optional location/days | `[{date,label,highC,condition}]` | authenticated | Partial; `fetchWeatherForecast()` returns `[]`; not used by the weather page |
| GET | `/api/v1/weather/risk-days` | Seven-day forecast risk | weather | — | `[{date,label,highC,condition,riskScore}]` | authenticated | Partial; mock returns `[]` |
| GET | `/api/v1/weather/history` | Historical weather observations | weather, reports | `from,to,location?` | dated weather observations | authenticated | Missing |
| GET | `/api/v1/weather/correlation` | Risk vs temperature series | weather | `days` (7 or 30) | `[{day,riskScore,temperatureC}]` | authenticated | Partial; mock returns `[]` |
| GET | `/api/v1/coverage` | Coverage score, stations, and underserved areas | coverage, reports | optional ring minutes | `{score,changePercent,stations,underserved:[{area,estimatedResponseMinutes}]}` | admin, prevention, operations | Partial; zero score and empty arrays |
| GET | `/api/v1/coverage/rings` | 5/10/15-minute coverage isochrones | coverage | `minutes:[5,10,15]` | GeoJSON features by station/time | admin, prevention, operations | Partial; current rings are client circles (`minutes * 280m`), not drive-time polygons |
| POST | `/api/v1/coverage/stations/plan` | Simulate a hypothetical new station | coverage | `lat,lng` | `{id,lat,lng,beforeScore,afterScore}` and optionally affected areas | admin, prevention | Partial; mock scores are always zero; no station is created |
| GET | `/api/v1/dashboard/summary` | Consolidated KPIs, top 5 barangays, monthly series, recent incidents | dashboard | optional date/year | KPI fields; top areas; monthly `{year,month,count}`; recent incident records | all roles with dashboard access | Missing; page makes five separate reads and derives its own KPI values |
| GET | `/api/v1/trends` | Period summary and historical/predicted trend points | trends | `period` (`3m`,`6m`,`12m`,`ytd`) | `{period,kpis:{incidentsYtd,incidentsChangePercent,averageRisk,averageRiskChangePercent,peakMonth,peakMonthIncidents,forecastTrend,forecastChangePercent},points:[{month,historical,predicted}]}` | admin, prevention, analyst | Partial; zero/empty shape only |
| GET | `/api/v1/trends/barangays` | Barangay risk ranking | trends | period/limit | `[{id,name,score}]` | admin, prevention, analyst | Partial; client sorts the risk-area list instead |
| GET | `/api/v1/trends/export.csv` | Export trend series | trends | `period` | `text/csv` | admin, prevention, analyst | Partial; browser generates CSV |
| GET | `/api/v1/alerts` | Alert list for operational tabs and topbar feed | alerts, shared layout | optional `type,level,read,limit` | `[{id,type,level,message,createdAt,read,acknowledged,area,areaId,score,topFactors,weather:{temperatureC,humidityPercent,windKph}}]` | authenticated; see analyst access inconsistency below | Partial; empty module array; current real path is `/alerts/operational` |
| POST | `/api/v1/alerts/{id}/acknowledge` | Acknowledge one alert | alerts | optional actor (derive from token) | updated alert | admin, prevention, operations | Partial; API helper exists but page's Acknowledge button is not wired |
| POST | `/api/v1/alerts/read` | Mark all alerts read | alerts | — | 204 or unread count | authenticated with alert access | Partial; mock mutates array, page does not refresh its displayed unread state |
| GET | `/api/v1/alerts/rules` | Read threshold, channel, quiet-hours, recipient rules | alerts | — | `{moderateThreshold,highThreshold,veryHighThreshold,channels:{inApp,email,sms},quietHours,recipients:{admin,prevention,operations,analyst}}` | admin, prevention | Partial; default client rules only |
| PUT | `/api/v1/alerts/rules` | Save alert rules | alerts | rules object above | saved rules | admin, prevention | Partial; module mock stores rules in memory |
| POST | `/api/v1/whatif/simulations` | Run an authoritative risk simulation | what-if | `areaId,temperatureC,humidityPercent,rainfallMm,windKph` | `{score,level,delta,factors,explanation,modelVersion,confidence}` | admin, prevention | Missing; current computation is a client-side formula |
| GET | `/api/v1/whatif/scenarios` | List saved scenarios | what-if | optional `areaId` | scenario list | admin, prevention | Missing; list is localStorage only |
| POST | `/api/v1/whatif/scenarios` | Save scenario | what-if | `name,areaId,conditions` | saved scenario `{id,name,areaId,areaName,conditions,score,level,savedAt}` | admin, prevention | Missing; saved to localStorage only |
| DELETE | `/api/v1/whatif/scenarios/{id}` | Delete saved scenario | what-if | path `id` | 204 | admin, prevention | Missing; deleted from localStorage only |
| GET | `/api/v1/reports` | List generated reports | reports | optional page | report records `{id,title,fileName,sizeLabel,generatedBy,generatedAt,settings}` | admin, prevention, analyst | Partial; empty in-memory list |
| POST | `/api/v1/reports/preview` | Fetch real section data for live preview | reports | `title,dateStart,dateEnd,areaId,sections[]` | rendered/structured section payloads | admin, prevention, analyst | Missing; every preview section currently says “No data available” |
| POST | `/api/v1/reports` | Create and persist a report/PDF | reports | report settings + `generatedBy` (prefer actor from token) | report record and PDF metadata/content reference | admin, prevention, analyst | Partial; only metadata is stored; PDF is generated client-side |
| GET | `/api/v1/reports/{id}/download` | Download persisted PDF | reports | path `id` | `application/pdf` | admin, prevention, analyst | Missing; browser generates a minimal substitute PDF from report metadata |
| DELETE | `/api/v1/reports/{id}` | Delete report record/file | reports | path `id` | 204 | admin, prevention, analyst | Partial; removes in-memory metadata only |
| GET | `/api/v1/models/evaluation` | List models, metrics, active model, confusion matrix, dataset state | ml-evaluation | — | `models:[{id,name,active,metrics:{accuracy,precision,recall,f1,rocAuc},confusionMatrix}]`, `fileName,uploadedRecords,steps` | analyst, admin | Partial; returns empty models/steps and blank dataset info |
| POST | `/api/v1/models/datasets` | Upload/validate dataset | ml-evaluation | multipart CSV file (10 MB UI limit) | `{fileName,uploadedRecords,validation,steps}` | analyst, admin | Missing; page only reads file text locally and counts lines |
| POST | `/api/v1/models/retrain` | Retrain/evaluate a model | ml-evaluation | `datasetId,modelId?` | job/model metrics/status | analyst, admin | Missing; retrain button is permanently disabled |
| PUT | `/api/v1/models/active` | Select active model | ml-evaluation | `modelId` | active model | analyst, admin | Missing; no selection control |
| GET | `/api/v1/geocoding/search` | Server-side Nominatim search/proxy | risk-map | `q`, bounded Tacloban view | `[{id,name,lat,lng}]` | authenticated map users | Partial; direct client Nominatim search exists, but no server endpoint |
| GET | `/api/v1/geocoding/reverse` | Reverse coordinate lookup | risk-map, coverage, incidents | `lat,lng` | `{name,address,barangay?}` | authenticated map users | Missing; no reverse-geocode call found |

## 2. External services

| Service | Use in app | Usage/rate/operational rules and audit notes |
|---|---|---|
| Open-Meteo | `weatherAnalysis.js` calls `/v1/forecast` for current weather at Tacloban coordinates (11.2444, 125.0036), timezone Asia/Manila. | The client has no cache, request throttling, retry/backoff, or attribution in the returned UI beyond a source label. Check current Open-Meteo service terms and applicable request limits for the chosen plan before production; cache by location/time and avoid one request per user interaction. Current mapper only supplies a few fields and maps `is_day` to `"sun"`/`"rain"` rather than interpreting `weather_code`. |
| Nominatim public service | `nominatim.js` directly calls `https://nominatim.openstreetmap.org/search`, constrained to the Philippines and Tacloban viewbox; map search uses it after debounce. | Public Nominatim policy is generally **maximum 1 request/second per application**, requires an identifying `User-Agent` or `Referer`, attribution, caching, and forbids autocomplete-style use of the public endpoint. The app sends `Accept` but no explicit identifying `User-Agent`, and the interaction is search-as-you-type. Route requests through a compliant provider/proxy or switch geocoder; debounce/throttle, cache, provide attribution, and do not use public Nominatim for autocomplete. The current catch silently falls back to local barangay-name matches for non-abort errors, returning null coordinates. |
| OpenStreetMap standard tiles | Leaflet `map-view.js` loads `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` for interactive map layers. | Keep visible `© OpenStreetMap contributors` attribution (already configured in Leaflet). Follow the tile usage policy: no bulk/prefetch scraping, honor caching, do not assume guaranteed SLA, and use an appropriate commercial/self-hosted tile service for production scale. |

## 3. Page-by-page UI, API contract, and data provenance

“Live-ready” means the data can be bound when a real response arrives; it does not mean the production backend exists. Empty mock arrays and fake success-only interfaces remain **mock**, not production-ready.

| Page | UI element / API function and expected field(s) | Current source/status |
|---|---|---|
| login | Login form, role preview, remember-email; `getManagedUsers()`, `roleFromEmail()`, `signIn(email,password)` → user `{id,name,email,role,stationUnit}` and `{ok,message}` | Hard-coded four accounts and localStorage mock session. No auth API call. Illustration is decorative mock map; “forgot password” only shows support text. |
| dashboard | KPI cards: `fetchIncidents()` array length; `fetchRiskAreas()` `score,level,trend`; `fetchStations()` `operational`; `fetchMonthlyIncidents()` `year,month,count`; `fetchWeather()` `temperatureC,feelsLikeC,humidityPercent,rainfallMm,windKph` | All mock/empty. KPI “hotspots” is risk-area count; city gauge uses highest area, not a city score. |
| dashboard | Gauge/risk chip and top-five list: highest `area.score`, `area.level`, `area.trend`, `area.name`; mini-map uses risk areas/incidents/stations | Live-ready shape but empty. Static sparkline shape and greeting/date are UI decoration, not API metrics. Recent list uses incident `barangay,class,id`. |
| risk-map | Map risk-zone polygons/labels and hotspot circles: `fetchRiskForDay(day)` area `geometry,center,score,id,name,level`; incidents use `lat,lng,id,class|fireClass,date,time`; stations use `lat,lng,name,address|barangay,coverageRadiusMeters` | Mock/empty. Hotspots are derived from risk-area centers, not a hotspot API. |
| risk-map | Day slider/timeline 0–7: `fetchRiskForDay(day)`; selected-area panel: `areaKm2,factors[{label,value}],explanation,nearestStation{name,distanceKm,responseMinutes}`; weather chips use `temperatureC,humidityPercent,windKph,windDirection` | Timeline API stub returns `[]`; panel expects fully populated embedded detail and can fail if `nearestStation`/`factors` are absent. |
| risk-map | Search suggestions: `nominatimSearch(query)` → `{id,name,lat,lng}` or fallback `{id,name,lat:null,lng:null,fallback:true}` | External live Nominatim (subject to policy issues above) with hard-coded barangay fallback; no reverse lookup. Map tiles are live OSM. |
| weather | Current weather hero/stats: `fetchWeatherAnalysis()` → `temperatureC,feelsLikeC,humidityPercent,rainfallMm,windKph,windDirection,pressureHpa,condition,updatedAt` | Mock zero-valued object; live Open-Meteo path is available in this API module but bypassed while `USE_MOCKS=true`. |
| weather | 7-day forecast: `fetchWeatherRiskDays()` → `label,condition,highC,riskScore`; 30-day chart: `fetchWeatherCorrelation(days)` → `day,riskScore,temperatureC`; risk-pattern count from area score and `"Historical frequency"` factor | Forecast and correlation mock arrays empty; empty forecast labels include a hard-coded weekday sequence. Text chips “High temp / Low humidity / Low rain / Strong wind” are static. |
| trends | KPI cards from `fetchTrends(period).kpis`: `incidentsYtd,incidentsChangePercent,averageRisk,averageRiskChangePercent,peakMonth,peakMonthIncidents,forecastTrend,forecastChangePercent` | Mock zero/default values; trend periods are UI filter. |
| trends | Historical/predicted chart from `points[{month,historical,predicted}]`; barangay ranking from sorted `fetchRiskAreas()` `{id,name,score}`; CSV export from these points | Empty mock points/areas. CSV is client-generated. |
| what-if | Area selector/condition sliders: `fetchWhatIfAreas()` areas with `id,name,currentConditions{temperatureC,humidityPercent,rainfallMm,windKph},whatIfBaseline,factors[{label,value}]`; result uses `simulateRisk()` → `{score,level,delta,factors}` | Area API returns `[]`; formula/calibration and presets are hard-coded client logic, not backend model output. UI hard-codes “Model confidence 89% / Random Forest v2.4.” |
| what-if | “Save scenario”, saved list, delete | LocalStorage `sigatacloban-phase3` only; no API. Scenario fields stored locally: `id,name,areaId,areaName,conditions,score,level,savedAt`. |
| incidents | Search, barangay, date range, fire class, severity, sort/page, table/cards/map/detail drawer: `listIncidents()` response `{rows,total,page,pageSize}` with incident fields described above; area selectors from `fetchRiskAreas()`; barangay selector from `BARANGAY_NAMES`; coverage data from `getCoverage()` | Incident mock starts empty. Barangay names are hard-coded; filters/sort occur client-side. Page loads coverage/risk areas partly for map/incident forms. |
| incidents | Add/edit/delete forms; CSV export | `createIncident`, `updateIncident`, `deleteIncident` mutate in-memory mock list; the form submits `barangay,fireClass,class,severity,severityLabel,date,time,cause,responseMinutes,notes,lat,lng,areaId`. Export CSV is client-side from loaded rows (initial request fetches up to 1000). |
| coverage | Map risk/incident/station layers and 5/10/15-minute toggles: `getCoverage()` stations/`fetchRiskAreas()`/`fetchIncidents()`; ring geometry synthesized by map code | Data mock/empty; rings are client circles with an assumed `280m/min`, not actual travel-time coverage. |
| coverage | Score card and underserved list: `score,changePercent,underserved[{area:{id,name,level},estimatedResponseMinutes}]`; planning map calls `planCoverageStation(lat,lng)` → `beforeScore,afterScore` | Mock values are all zero/empty; planning is explicitly hypothetical and does not create a station. Barangay-only search is client filtering, not geocoding. |
| alerts | Tabs, severity/search filters and cards: `listAlerts()` alert fields `id,type,level,message,createdAt,read,acknowledged,area,areaId,score,topFactors,weather{temperatureC,humidityPercent,windKph}` | Empty mock list. Acknowledge button is displayed but has no handler; `acknowledgeAlert()` is not imported/called by this page. |
| alerts | Mark all read and alert-rule modal | `markAllRead()`, `getAlertRules()`, `saveAlertRules()`; rules include thresholds, channels, quiet hours, recipients. Mock read/rule changes are in-memory. Page shows SMS/email as disabled “Coming later”. |
| alerts + shared layout | Bell popover/unread badges and alert nav badge: layout calls `listAlerts()`, counts `!read`, displays first five `message,area,type,areaId` | Same empty mock list. Notifications load for every signed-in role even though analyst is not allowed the Alerts route in the current role matrix. |
| reports | Builder fields and preview: `fetchRiskAreas()`, `fetchWeatherAnalysis()`, `getCoverage()`, `listIncidents()`; settings `title,dateStart,dateEnd,areaId,sections[]` | Input settings are client-only. Preview pages are hard-coded placeholders (“No data available”); no preview API. Date defaults to Sep 2024. |
| reports | Past-report table: `listReports()` → `id,title,fileName,sizeLabel,generatedBy,generatedAt,settings`; create/delete/duplicate | Report list/create/delete are in-memory mocks. PDF is assembled client-side with vendor libraries; past-download creates a minimal PDF from metadata, not a stored report download. |
| users | User stats/table/search/role filter/status actions: `listUsers()` → `id,name,email,role,stationUnit,lastActive,active,pendingInvite`; static `roleLabels/rolePermissions` | Four hard-coded mock accounts; add/update/delete mocks reject writes (password reset/invite only return IDs). |
| users | Add/edit/activate/deactivate/delete/reset/resend invite | Calls `addUser`, `updateUser`, `deleteUser`, `resetUserPassword`, `resendInvite`; user write flows are implemented in UI but mock writes fail. Permission matrix is read-only and hard-coded. |
| ml-evaluation | Model cards/comparison chart: `fetchModelEvaluation()` → `models[{name,metrics:{accuracy,precision,recall,f1,rocAuc}}]`; page expects metric values in percent | Empty mock model list. Confusion matrix is always “No validated model”; no confusion-matrix rendering or active-model selection. |
| ml-evaluation | Dataset upload/retrain | Upload only reads local CSV text and counts nonempty data rows; progress is simulated. `fileName/uploadedRecords` update locally. Retrain button is disabled; no upload/retrain API. |
| style-guide | Component demonstrations and sample table/stats | No API calls. Fake examples include Barangay 77/88, risk scores 82/78, total incidents 248, active stations 9 and 92% operational. |
| 403 | Access-denied explanation and dashboard link | No API call; page access decision is client-side route guard. Backend must still enforce authorization. |
| 404 | Not-found copy and dashboard link | No API call; app redirects anonymous visitors to login. |

## 4. Inconsistencies and hard-coded data

1. **Parallel incident APIs and response shapes:** `api/incidents.js` exports `fetchIncidents()` and returns a plain array (mock `[]`); `api/incidentsPartA.js` exports the CRUD/filter module and returns `{rows,total,page,pageSize}`. Dashboard/risk-map/coverage use the first; incidents/reports use the second. Unify on one typed contract before wiring FastAPI.
2. **Duplicate/partial alerts module:** only `api/alertsPartA.js` was found. It provides operational list, acknowledgement, mark-all-read and rules, but acknowledgement is not connected in `pages/alerts.js`. UI layout and alerts page independently call the same list. No separate implemented notification-feed API or second alerts module was found.
3. **Weather module split:** `api/weather.js` provides `fetchWeather()` → `null` and `fetchWeatherForecast()` → `[]`; `api/weatherAnalysis.js` provides a different current-weather object (zero-valued mock) plus risk days/correlation and direct Open-Meteo access. Pages use both patterns. Forecast UI also expects `label/highC/riskScore`, while `fetchWeatherForecast()` has no defined contract.
4. **Risk summary conflation:** dashboard treats the highest barangay score as city risk and counts all area records as predicted hotspots. The risk map derives hotspots from each area center. Neither is equivalent to explicit city score/hotspot API data.
5. **Incident field aliases:** map popup uses `incident.class ?? incident.fireClass`; dashboard reads `class`; table/forms/export read `fireClass`; severity uses both `severity` (lowercase map/CSS class) and `severityLabel` (human-readable filter/table). Canonicalize `fireClass` and an enum `severity` plus label mapping.
6. **Incident list response mismatch:** `fetchIncidents()` array vs `listIncidents()` paginated object. Incident page requests 1000 rows and paginates locally; API pagination cannot be efficient until UI consumes server pagination.
7. **Risk detail contract is assumed, not validated:** selected-area renderer dereferences `area.factors`, `area.nearestStation`, `area.explanation`, `area.areaKm2`; other screens use only `id/name/score/level/trend/center`. Establish one schema and optionality (currently details are effectively required by the panel).
8. **Current weather nullability differs:** dashboard accepts null; risk detail uses optional chaining; weather page expects an object and falls back to placeholders. Analysis mock returns numeric zeros and empty timestamp, so “no data” can look like zero measurements.
9. **Location fields differ:** `center` is consumed as `[lat,lng]`, map incidents/stations use scalar `lat,lng`, GeoJSON is required for polygons. Search fallback has nullable coordinates; click actions must not treat a fallback as a geocode.
10. **User mutations do not match the mock:** mock users are frozen; add/update throw fixed-directory errors; delete returns false for own/not-found and otherwise throws. UI add-user callback catches internally and may close as if saved; list state is not reloaded after mutations.
11. **Authorization disagreement:** role matrix gives analyst `/reports` and `/ml-evaluation` but not `/alerts`, yet shared layout requests alerts for any authenticated role. The same matrix is client-only and must not substitute for API authorization.
12. **Local-only features presented as saved/server actions:** What-If scenarios use localStorage; report preview/download/PDF content is browser-generated; dataset upload is local file reading; CSVs are browser-generated. These need explicit API-backed workflows for multi-user persistence/auditability.
13. **Hard-coded/fake content outside API layer:** account identities and login behavior (`core/auth.js`); barangay names (`api/barangays.js`); alert rules; What-If presets, calibration, model confidence/version; weather risk-pattern copy and empty weekdays; report default title/date and placeholder section content; style-guide statistics/examples; login illustrative map. Some are legitimate UI copy/design fixtures, but none should be treated as operational records.
14. **Unversioned route mismatch:** current modules call `/incidents`, `/risk/areas`, `/coverage`, etc. with base `/api`, while target contract requires `/api/v1/...`. `requestJson` adds bearer auth when a local token exists, but there is no refresh flow. External Nominatim calls bypass the API client and its error handling.

## 5. Implementation priority

1. **Authentication and server-side authorization first:** login, logout, current-user, refresh, consistent role/permission contract and API enforcement. Then remove fixed account identities and local mock credentials. Decide whether analyst should receive the notification feed/alerts access.
2. **Canonical reference/geospatial data:** barangay list + stable IDs + GeoJSON boundaries; station CRUD and normalized coordinates; shared incident and area schemas. These are prerequisites for map, filters, coverage, dashboard, reports, and scenario selection.
3. **Core operational/risk data:** incident CRUD/filtering and real risk-area/city/forecast/detail endpoints, with factors, explanations, weather snapshot, and nearest-station data. Replace client-side “city score” and derived hotspot approximations.
4. **Weather provider contract and resilience:** current + 7-day + history/correlation endpoints, caching and documented units/nullability; proxy or otherwise control external service usage. Avoid zero-valued mock data masquerading as valid observations.
5. **Dependent aggregates:** dashboard summary, monthly counts, trends and exports; coverage score, isochrones/underserved areas and station-placement simulation. These depend on canonical incidents, barangays, stations, risk, and weather.
6. **Persisted workflows:** alert feed/ack/read/rules; server-side What-If simulation/scenarios; report preview/create/PDF download; user lifecycle. Add audit logging and actor identity from JWT, not request-body identity.
7. **ML lifecycle last:** dataset upload/validation, retraining jobs, model metrics/confusion matrix, active-model selection and model version/confidence. It depends on finalized dataset, incident labels, and risk feature contracts.

## Files opened

- `sigatacloban-web/index.html`
- `sigatacloban-web/assets/js/app.js`
- `sigatacloban-web/assets/js/core/auth.js`
- `sigatacloban-web/assets/js/core/layout.js`
- `sigatacloban-web/assets/js/core/permissions.js`
- `sigatacloban-web/assets/js/core/router.js`
- `sigatacloban-web/assets/js/api/client.js`
- `sigatacloban-web/assets/js/api/config.js`
- `sigatacloban-web/assets/js/api/mockDelay.js`
- `sigatacloban-web/assets/js/api/alertsPartA.js`
- `sigatacloban-web/assets/js/api/barangays.js`
- `sigatacloban-web/assets/js/api/coverage.js`
- `sigatacloban-web/assets/js/api/incidents.js`
- `sigatacloban-web/assets/js/api/incidentsPartA.js`
- `sigatacloban-web/assets/js/api/models.js`
- `sigatacloban-web/assets/js/api/nominatim.js`
- `sigatacloban-web/assets/js/api/reports.js`
- `sigatacloban-web/assets/js/api/risk.js`
- `sigatacloban-web/assets/js/api/stations.js`
- `sigatacloban-web/assets/js/api/trends.js`
- `sigatacloban-web/assets/js/api/users.js`
- `sigatacloban-web/assets/js/api/weather.js`
- `sigatacloban-web/assets/js/api/weatherAnalysis.js`
- `sigatacloban-web/assets/js/api/whatif.js`
- `sigatacloban-web/assets/js/pages/alerts.js`
- `sigatacloban-web/assets/js/pages/coverage.js`
- `sigatacloban-web/assets/js/pages/dashboard.js`
- `sigatacloban-web/assets/js/pages/errors.js` (shared by 403 and 404)
- `sigatacloban-web/assets/js/pages/incidents.js`
- `sigatacloban-web/assets/js/pages/login.js`
- `sigatacloban-web/assets/js/pages/ml-evaluation.js`
- `sigatacloban-web/assets/js/pages/reports.js`
- `sigatacloban-web/assets/js/pages/risk-map.js`
- `sigatacloban-web/assets/js/pages/style-guide.js`
- `sigatacloban-web/assets/js/pages/trends.js`
- `sigatacloban-web/assets/js/pages/users.js`
- `sigatacloban-web/assets/js/pages/weather.js`
- `sigatacloban-web/assets/js/pages/what-if.js`
- `sigatacloban-web/assets/js/maps/layers.js`
- `sigatacloban-web/assets/js/maps/map-view.js`
- `sigatacloban-web/assets/js/utils/simulate-risk.js`
