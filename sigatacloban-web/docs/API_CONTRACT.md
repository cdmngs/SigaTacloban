# SigaTacloban API contract

This is the shared client/backend contract for the SigaTacloban web app. All application endpoints are rooted at `/api/v1`. The client mock uses the success examples in `assets/data/samples/`; live API responses must use the same envelope and field shapes.

## Conventions

- Every successful response is `{ "data": ..., "meta": { ... } }`. `meta` is an object and may be empty for non-list responses. List endpoints return the array in `data` and `meta.total`, `meta.page`, and `meta.pageSize`.
- Every error is `{ "error": { "code": "...", "message": "...", "details": ... } }`. `details` may be `null`; validation details should identify invalid fields. HTTP status is authoritative.
- IDs are opaque strings. Dates are ISO 8601 calendar dates (`YYYY-MM-DD`); timestamps are ISO 8601 with timezone (`YYYY-MM-DDTHH:mm:ssZ` or offset); times are ISO 8601 local times (`HH:mm:ss`) when a date is separately present.
- Numeric risk scores use `riskScore` in `[0,100]`. Risk levels are exactly `Low`, `Moderate`, `High`, `Very High` in the API. UI compatibility adapters may map these to lowercase CSS keys.
- Coordinates are numeric `{ "lat": ..., "lng": ... }` in WGS84 decimal degrees. GeoJSON coordinates follow the GeoJSON longitude/latitude order.
- Weather units are Celsius (`temperatureC`, °C), relative humidity percent (`humidityPercent`, %), rainfall millimeters (`rainfallMm`, mm), and wind kilometers/hour (`windKph`, km/h). Pressure is hPa; distance is km; area is km²; response duration is minutes.
- Optional values are nullable rather than omitted when the field is part of the declared object. List filters may be omitted. Query values use URL encoding.
- Authorization is enforced by the backend on every request. Role codes: `admin`, `prevention`, `operations`, `analyst`. Client-side route rules are not security controls.

## Standard error responses

The following error envelope applies to every endpoint. The specific `code`, message, status, and field-level details vary by endpoint and error cause.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid or missing fields.",
    "details": { "field": "fieldName", "reason": "required" }
  }
}
```

The shared error sample is [`error.json`](../assets/data/samples/error.json). Typical status mappings: `400` invalid request, `401` missing/expired authentication, `403` insufficient role, `404` resource absent, `409` duplicate/conflicting change, `422` schema validation, `429` rate limit, `500` unexpected server failure. A `204` endpoint still uses the success envelope when returning JSON; otherwise it returns no body and the client adapter normalizes it to `{data:null,meta:{}}`.

## Endpoint definitions

`Success sample` links are complete enveloped JSON payloads in the repository. The shared error response above applies to every row. `—` means no query parameters or request body.

The role matrix is keyed by role code (`admin`, `prevention`, `operations`, `analyst`). Each role object includes `routes` (allowed application route paths), `capabilities` (boolean action permissions), and resource operation arrays such as `users:["read","write"]`. The client uses explicit routes and capabilities when provided; backend authorization remains authoritative. Reading this matrix and alert-rule thresholds is available to every authenticated role; writing alert rules remains restricted to `admin` and `prevention`.

| Method | Path | Purpose | Roles | Query parameters | Request body | Success response example |
|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | Authenticate and issue access/refresh JWTs | Public | — | `{email,password}` | [`auth-login.json`](../assets/data/samples/auth-login.json) |
| POST | `/api/v1/auth/logout` | Revoke refresh token/session | Authenticated | — | `{refreshToken}` | [`auth-logout.json`](../assets/data/samples/auth-logout.json) |
| GET | `/api/v1/auth/me` | Return authenticated identity and role | Authenticated | — | — | [`auth-me.json`](../assets/data/samples/auth-me.json) |
| POST | `/api/v1/auth/refresh` | Rotate access and refresh tokens | Authenticated refresh token | — | `{refreshToken}` | [`auth-refresh.json`](../assets/data/samples/auth-refresh.json) |
| GET | `/api/v1/users` | Search/list user accounts | admin | `q`, `role`, `active`, `page`, `pageSize` | — | [`users-list.json`](../assets/data/samples/users-list.json) |
| POST | `/api/v1/users` | Create a user and invitation | admin | — | `{name,email,role,stationUnit,active}` | [`users-create.json`](../assets/data/samples/users-create.json) |
| PATCH | `/api/v1/users/{id}` | Update profile, role, or status | admin | — | Partial `{name,role,stationUnit,active,pendingInvite}` | [`users-update.json`](../assets/data/samples/users-update.json) |
| POST | `/api/v1/users/{id}/activate` | Activate a user account | admin | — | — | [`users-activate.json`](../assets/data/samples/users-activate.json) |
| POST | `/api/v1/users/{id}/deactivate` | Deactivate a user account | admin | — | — | [`users-deactivate.json`](../assets/data/samples/users-deactivate.json) |
| DELETE | `/api/v1/users/{id}` | Delete a user account | admin | — | — | [`users-delete.json`](../assets/data/samples/users-delete.json) |
| POST | `/api/v1/users/{id}/password-reset` | Send a password-reset workflow | admin | — | — | [`users-password-reset.json`](../assets/data/samples/users-password-reset.json) |
| POST | `/api/v1/users/{id}/invite` | Resend an account invitation | admin | — | — | [`users-invite.json`](../assets/data/samples/users-invite.json) |
| GET | `/api/v1/roles/permissions` | Read the role-permission matrix used for route and action authorization | Authenticated | — | — | [`roles-permissions.json`](../assets/data/samples/roles-permissions.json) |
| GET | `/api/v1/barangays` | List barangays and map centers | admin, prevention, operations, analyst | `q`, `page`, `pageSize` | — | [`barangays-list.json`](../assets/data/samples/barangays-list.json) |
| GET | `/api/v1/barangays/boundaries` | Return boundary GeoJSON | admin, prevention, operations, analyst | `barangayId` | — | [`barangays-boundaries.json`](../assets/data/samples/barangays-boundaries.json) |
| GET | `/api/v1/stations` | List fire stations | admin, prevention, operations, analyst | `operational`, `page`, `pageSize` | — | [`stations-list.json`](../assets/data/samples/stations-list.json) |
| POST | `/api/v1/stations` | Add a fire station | admin | — | `{name,lat,lng,address,barangay,coverageRadiusMeters}` | [`stations-create.json`](../assets/data/samples/stations-create.json) |
| PATCH | `/api/v1/stations/{id}` | Update station details/status | admin | — | Partial station fields | [`stations-update.json`](../assets/data/samples/stations-update.json) |
| GET | `/api/v1/incidents` | Filter, sort, and paginate incident records | admin, operations, analyst | `barangay`, `from`, `to`, `fireClass`, `severity`, `search`, `page`, `pageSize`, `sort`, `direction` | — | [`incidents-list.json`](../assets/data/samples/incidents-list.json) |
| GET | `/api/v1/incidents/options` | Return incident form options | admin, operations | — | — | [`incidents-options.json`](../assets/data/samples/incidents-options.json) |
| GET | `/api/v1/incidents/{id}` | Retrieve incident details | admin, operations, analyst | — | — | [`incidents-detail.json`](../assets/data/samples/incidents-detail.json) |
| POST | `/api/v1/incidents` | Create an incident record | admin, operations | — | `{areaId,barangay,date,time,fireClass,severity,cause,responseMinutes,notes,lat,lng}` | [`incidents-create.json`](../assets/data/samples/incidents-create.json) |
| PATCH | `/api/v1/incidents/{id}` | Update an incident record | admin, operations | — | Partial incident fields | [`incidents-update.json`](../assets/data/samples/incidents-update.json) |
| DELETE | `/api/v1/incidents/{id}` | Delete an incident record | admin, operations | — | — | [`incidents-delete.json`](../assets/data/samples/incidents-delete.json) |
| GET | `/api/v1/incidents/export.csv` | Export filtered incidents as CSV | admin, operations, analyst | Same incident filters as list | — | [`incidents-export.json`](../assets/data/samples/incidents-export.json) |
| GET | `/api/v1/incidents/monthly` | Monthly incident count series | admin, prevention, operations, analyst | `year` | — | [`incidents-monthly.json`](../assets/data/samples/incidents-monthly.json) |
| GET | `/api/v1/risk/city` | Current city risk score/class and horizon | admin, prevention, operations, analyst | `asOf` | — | [`risk-city.json`](../assets/data/samples/risk-city.json) |
| GET | `/api/v1/risk/areas` | Barangay risk zones and details | admin, prevention, operations, analyst | `day`, `page`, `pageSize` | — | [`risk-areas.json`](../assets/data/samples/risk-areas.json) |
| GET | `/api/v1/risk/forecast/{day}` | Day 0–7 risk forecast | admin, prevention, operations, analyst | — | — | [`risk-forecast.json`](../assets/data/samples/risk-forecast.json) |
| GET | `/api/v1/risk/hotspots` | Explicit hotspot layer records | admin, prevention, operations, analyst | `day`, `limit` | — | [`risk-hotspots.json`](../assets/data/samples/risk-hotspots.json) |
| GET | `/api/v1/risk/areas/{id}` | Selected-area factors, explanation, conditions, nearest station | admin, prevention, operations, analyst | `day` | — | [`risk-area-detail.json`](../assets/data/samples/risk-area-detail.json) |
| GET | `/api/v1/weather/current` | Current weather observations | admin, prevention, operations, analyst | `lat`, `lng` | — | [`weather-current.json`](../assets/data/samples/weather-current.json) |
| GET | `/api/v1/weather/forecast` | Seven-day daily weather forecast | admin, prevention, analyst | `lat`, `lng`, `days` | — | [`weather-forecast.json`](../assets/data/samples/weather-forecast.json) |
| GET | `/api/v1/weather/risk-days` | Seven-day weather and risk forecast | admin, prevention, analyst | `lat`, `lng` | — | [`weather-risk-days.json`](../assets/data/samples/weather-risk-days.json) |
| GET | `/api/v1/weather/history` | Historical weather observations | admin, prevention, analyst | `from`, `to`, `lat`, `lng` | — | [`weather-history.json`](../assets/data/samples/weather-history.json) |
| GET | `/api/v1/weather/correlation` | Daily risk-vs-temperature series | admin, prevention, analyst | `days` (7 or 30), optional `areaId` | — | [`weather-correlation.json`](../assets/data/samples/weather-correlation.json) |
| GET | `/api/v1/coverage` | Coverage score, stations, underserved high-risk areas | admin, prevention, operations | `page`, `pageSize` | — | [`coverage-summary.json`](../assets/data/samples/coverage-summary.json) |
| GET | `/api/v1/coverage/rings` | 5/10/15-minute coverage isochrones | admin, prevention, operations | `minutes` (subset of 5, 10, 15) | — | [`coverage-rings.json`](../assets/data/samples/coverage-rings.json) |
| POST | `/api/v1/coverage/stations/plan` | Simulate coverage effect of a proposed station | admin, prevention | — | `{lat,lng}` | [`coverage-plan.json`](../assets/data/samples/coverage-plan.json) |
| GET | `/api/v1/dashboard/summary` | KPIs, top five barangays, monthly series, recent incidents | admin, prevention, operations, analyst | `from`, `to`, `year` | — | [`dashboard-summary.json`](../assets/data/samples/dashboard-summary.json) |
| GET | `/api/v1/trends` | Period summary and historical/predicted points | admin, prevention, analyst | `period` (`3m`, `6m`, `12m`, `ytd`), optional `areaId` | — | [`trends-summary.json`](../assets/data/samples/trends-summary.json) |
| GET | `/api/v1/trends/barangays` | Risk ranking by barangay | admin, prevention, analyst | `period`, `limit`, optional `areaId` | — | [`trends-barangays.json`](../assets/data/samples/trends-barangays.json) |
| GET | `/api/v1/trends/export.csv` | Export selected trend series | admin, prevention, analyst | `period`, optional `areaId` | — | [`trends-export.json`](../assets/data/samples/trends-export.json) |
| GET | `/api/v1/alerts` | Alert list for operational tabs and topbar feed | admin, prevention, operations, analyst (feed only) | `type`, `level`, `read`, `page`, `pageSize` | — | [`alerts-list.json`](../assets/data/samples/alerts-list.json) |
| POST | `/api/v1/alerts/{id}/acknowledge` | Acknowledge one alert | admin, prevention, operations | — | `{}`; actor is derived from JWT | [`alerts-acknowledge.json`](../assets/data/samples/alerts-acknowledge.json) |
| POST | `/api/v1/alerts/read` | Mark current user's alerts read | admin, prevention, operations, analyst (feed only) | — | `{}` | [`alerts-read.json`](../assets/data/samples/alerts-read.json) |
| GET | `/api/v1/alerts/rules` | Read alert thresholds/channels/recipient roles and shared risk boundaries | Authenticated | — | — | [`alerts-rules.json`](../assets/data/samples/alerts-rules.json) |
| PUT | `/api/v1/alerts/rules` | Save alert rules | admin, prevention | — | `{moderateThreshold,highThreshold,veryHighThreshold,channels,quietHours,recipients}` | [`alerts-rules-put.json`](../assets/data/samples/alerts-rules-put.json) |
| GET | `/api/v1/whatif/areas` | List areas and baseline scenario conditions | admin, prevention | `page`, `pageSize` | — | [`whatif-areas.json`](../assets/data/samples/whatif-areas.json) |
| POST | `/api/v1/whatif/simulations` | Calculate scenario risk estimate | admin, prevention | — | `{areaId,temperatureC,humidityPercent,rainfallMm,windKph}` | [`whatif-simulation.json`](../assets/data/samples/whatif-simulation.json) |
| GET | `/api/v1/whatif/scenarios` | List saved scenarios | admin, prevention | `areaId`, `page`, `pageSize` | — | [`whatif-scenarios-list.json`](../assets/data/samples/whatif-scenarios-list.json) |
| POST | `/api/v1/whatif/scenarios` | Save scenario | admin, prevention | — | `{name,areaId,conditions}` | [`whatif-scenarios-create.json`](../assets/data/samples/whatif-scenarios-create.json) |
| DELETE | `/api/v1/whatif/scenarios/{id}` | Delete saved scenario | admin, prevention | — | — | [`whatif-scenarios-delete.json`](../assets/data/samples/whatif-scenarios-delete.json) |
| GET | `/api/v1/reports` | List generated reports | admin, prevention, analyst | `page`, `pageSize` | — | [`reports-list.json`](../assets/data/samples/reports-list.json) |
| POST | `/api/v1/reports/preview` | Build structured report preview data | admin, prevention, analyst | — | `{title,dateStart,dateEnd,areaId,sections[]}` | [`reports-preview.json`](../assets/data/samples/reports-preview.json) |
| POST | `/api/v1/reports` | Create and persist a report/PDF | admin, prevention, analyst | — | `{settings:{title,dateStart,dateEnd,areaId,sections[]}}`; generated user derived from JWT | [`reports-create.json`](../assets/data/samples/reports-create.json) |
| GET | `/api/v1/reports/{id}/download` | Download generated PDF | admin, prevention, analyst | — | — | [`reports-download.json`](../assets/data/samples/reports-download.json) |
| DELETE | `/api/v1/reports/{id}` | Delete report and stored file | admin, prevention, analyst | — | — | [`reports-delete.json`](../assets/data/samples/reports-delete.json) |
| GET | `/api/v1/models/evaluation` | List models, metrics, active model and evaluation data | admin, analyst | — | — | [`models-evaluation.json`](../assets/data/samples/models-evaluation.json) |
| GET | `/api/v1/models/datasets` | List uploaded datasets and preparation summaries | admin, analyst | `page`, `pageSize` | — | [`models-datasets.json`](../assets/data/samples/models-datasets.json) |
| POST | `/api/v1/models/datasets` | Upload and validate model dataset | admin, analyst | Multipart `file` (CSV; UI limit 10 MB) | — | [`models-upload.json`](../assets/data/samples/models-upload.json) |
| POST | `/api/v1/models/retrain` | Queue model retraining/evaluation | admin, analyst | `{datasetId,modelId?}` | — | [`models-retrain.json`](../assets/data/samples/models-retrain.json) |
| GET | `/api/v1/models/jobs/{jobId}` | Retrieve retraining job status and result | admin, analyst | — | — | [`models-job.json`](../assets/data/samples/models-job.json) |
| PUT | `/api/v1/models/active` | Select active model | admin, analyst | — | `{modelId}` | [`models-active.json`](../assets/data/samples/models-active.json) |
| GET | `/api/v1/geocoding/search` | Search an address/place (provider proxy) | admin, prevention, operations | `q`, `viewbox`, `bounded`, `limit` | — | [`geocoding-search.json`](../assets/data/samples/geocoding-search.json) |
| GET | `/api/v1/geocoding/reverse` | Resolve coordinates to address/place | admin, prevention, operations | `lat`, `lng` | — | [`geocoding-reverse.json`](../assets/data/samples/geocoding-reverse.json) |

### Shared resource fields

- **User:** `id`, `name`, `email`, `role`, `stationUnit`, nullable ISO timestamp `lastActive`, boolean `active`, boolean `pendingInvite`.
- **Barangay:** `id`, `name`, `center:{lat,lng}`; boundaries are GeoJSON FeatureCollection.
- **Fire station:** `id`, `name`, `lat`, `lng`, nullable `address`, nullable `barangay`, boolean `operational`, nullable `coverageRadiusMeters`.
- **Incident:** `id`, `areaId`, `barangay`, `date`, `time`, `fireClass`, `severity`, `cause`, `responseMinutes`, nullable `notes`, `lat`, `lng`, `status`. Severity is the risk-level enum; consumers should not depend on a duplicate `class` alias.
- **Risk area:** `id`, `name`, `riskScore`, `riskLevel`, `trend`, `center:{lat,lng}`, GeoJSON `geometry`, `factors:[{label,value}]`, `explanation`, `areaKm2`, `nearestStation:{name,distanceKm,responseMinutes}`, `currentConditions:{temperatureC,humidityPercent,rainfallMm,windKph}`, `whatIfBaseline`.
- **Alert:** `id`, `type`, `riskLevel`, `message`, ISO `createdAt`, `read`, `acknowledged`, nullable `area`/`areaId`, nullable `riskScore`, `topFactors`, `weather:{temperatureC,humidityPercent,windKph}`.
- **Report:** `id`, `title`, `fileName`, `sizeLabel`, `generatedBy`, ISO `generatedAt`, `settings:{title,dateStart,dateEnd,areaId,sections[]}`.
- **Model:** `id`, `name`, `active`, `metrics:{accuracy,precision,recall,f1,rocAuc}`, `confusionMatrix`.

## External-service integration

The browser should call the `/api/v1/geocoding/*` and `/api/v1/weather/*` endpoints rather than public providers directly. A backend proxy allows caching, attribution, timeout policy, and provider replacement. The audit identified the current public Nominatim client as violating its public autocomplete usage expectations; do not restore direct typeahead requests to that endpoint. If Nominatim remains the provider, follow its then-current usage policy, including the 1 request/second limit, identifying User-Agent/Referer, caching, and attribution. Open-Meteo request limits depend on service/plan and must be checked against current terms; cache weather data by location and fetch time. Map tiles currently come from `tile.openstreetmap.org`; retain visible `© OpenStreetMap contributors` attribution, honor caching, avoid bulk/prefetch use, and use an appropriate provider for production availability/scale.

## Mock behavior

`USE_MOCK` in `assets/js/api/config.js` selects local sample envelopes in `assets/data/samples/`. Mock calls pass through the same shared client and validators as live calls. API modules may adapt the shared `{data,meta}` envelope to an existing page-facing return value; the wire/sample payload remains enveloped. Set `USE_MOCK = false` to route those same module calls to the API service without per-module switching.
