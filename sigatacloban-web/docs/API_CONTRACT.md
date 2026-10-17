# Static client API contract

This document records the REST-style requests and response shapes used by `assets/js/api/`. It is the client-side contract, not a backend specification: the React workspace has no authoritative `docs/API_CONTRACT.md` or running backend. Confirm endpoint naming and schemas with the service owner before setting `USE_MOCKS = false`.

## Transport

- Base URL: `API_BASE_URL` in `assets/js/api/config.js` (default `/api`).
- Requests use JSON with `Accept: application/json`; JSON request bodies use `Content-Type: application/json`.
- The shared client adds the persisted session token as a bearer auth header when present, times out after 15 seconds by default, signs out on HTTP 401, and shows an error toast on HTTP 403 or network failure.
- Successful JSON endpoints return the response body directly. `204 No Content` resolves to `undefined`.
- When `USE_MOCKS = true`, app API calls do not reach these endpoints. The mock delay is 400–700 ms; list results are empty except `GET /users`, which returns the four configured accounts.

## Endpoints used by the client

| Service export | Method and path | Request | Expected response |
| --- | --- | --- | --- |
| `fetchRiskAreas()` | `GET /risk/areas` | — | Risk area array |
| `fetchRiskForDay(day)` | `GET /risk/forecast/{day}` | URL-encoded day path segment | Forecast risk array |
| `fetchMonthlyIncidents()` | `GET /incidents/monthly` | — | Monthly incident series |
| `fetchStations()` | `GET /stations` | — | Fire station array |
| `fetchIncidents()` | `GET /incidents` | — | Incident array |
| `listIncidents(filters, page, pageSize, sort)` | `GET /incidents` | Query: filter fields, `page`, `pageSize`, `sort`, `direction` | `{ rows, total, page, pageSize }` |
| `getIncident(id)` | `GET /incidents/{id}` | URL-encoded ID | Incident |
| `createIncident(data)` | `POST /incidents` | Incident JSON | Created incident |
| `updateIncident(id, data)` | `PATCH /incidents/{id}` | Partial incident JSON | Updated incident or `204` |
| `deleteIncident(id)` | `DELETE /incidents/{id}` | URL-encoded ID | `204` |
| `fetchWeather()` | `GET /weather/now` | — | Current weather object |
| `fetchWeatherForecast()` | `GET /weather/forecast` | — | Forecast array |
| `fetchWeatherAnalysis()` / `fetchOpenMeteoWeather()` | External `GET https://api.open-meteo.com/v1/forecast` | Fixed Tacloban coordinates, current-weather fields, Manila timezone | `{ temperatureC, feelsLikeC, humidityPercent, rainfallMm, windKph, windDirection, pressureHpa, condition, updatedAt }` |
| `fetchWeatherRiskDays()` | `GET /weather/risk-days` | — | Risk-day array |
| `fetchWeatherCorrelation(days)` | `GET /weather/correlation?days={days}` | URL-encoded day count | Correlation series |
| `fetchTrends(period)` | `GET /trends?period={period}` | URL-encoded period | `{ period, kpis, points }` |
| `fetchWhatIfAreas()` | `GET /whatif/areas` | — | What-If area array |
| `fetchModelEvaluation()` | `GET /models/evaluation` | — | Model-evaluation result |
| `getCoverage()` | `GET /coverage` | — | `{ score, changePercent, stations, underserved }` |
| `planCoverageStation(lat, lng)` | `POST /coverage/stations/plan` | `{ lat, lng }` | `{ id, lat, lng, beforeScore, afterScore }` |
| `fetchAlerts()` | `GET /alerts` | — | Alert array |
| `listAlerts()` | `GET /alerts/operational` | — | Operational alert array |
| `acknowledgeAlert(id, user)` | `POST /alerts/{id}/acknowledge` | `{ user }` | Acknowledged alert or `204` |
| `markAllRead()` | `POST /alerts/read` | — | `204` |
| `getAlertRules()` | `GET /alerts/rules` | — | Alert rule object |
| `saveAlertRules(nextRules)` | `PUT /alerts/rules` | Alert rule JSON | Saved rules or `204` |
| `listReports()` | `GET /reports` | — | Report array |
| `createReport(settings, generatedBy)` | `POST /reports` | `{ settings, generatedBy }` | Saved report |
| `deleteReport(id)` | `DELETE /reports/{id}` | URL-encoded ID | `204` |
| `listUsers()` | `GET /users` | — | Managed-user array |
| `addUser(user)` | `POST /users` | User JSON | Created user |
| `updateUser(id, updates)` | `PATCH /users/{id}` | Partial user JSON | Updated user or `204` |
| `deleteUser(id, currentEmail)` | `DELETE /users/{id}` | `X-Current-User` header | `204` |
| `resetUserPassword(id)` | `POST /users/{id}/password-reset` | — | Reset acknowledgement |
| `resendInvite(id)` | `POST /users/{id}/invite` | — | Invite acknowledgement |
| `nominatimSearch(query, signal?)` | External `GET https://nominatim.openstreetmap.org/search` | `q`, `format=jsonv2`, `limit`, `countrycodes=ph`, bounded Tacloban `viewbox` | Nominatim result array |

## Shared API behavior

The modules and exported function signatures are defined in `assets/js/api/`. `USE_MOCKS` selects the empty local implementation for each service. Nominatim and the Open-Meteo function use their external service URLs directly; Open-Meteo stays behind the weather API module and is not called while mocks are enabled.
