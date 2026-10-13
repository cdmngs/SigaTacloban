# SigaTacloban# SigaTacloban static frontend

This is the plain HTML/CSS/JavaScript conversion. It runs without a build step or package installation.

## Run locally

From this directory, either:

- Open `login.html` with the VS Code Live Server extension, or
- Start a static server with `python -m http.server 8000` and open `http://localhost:8000/login.html`.

The map tiles, Nominatim search, and the optional Open-Meteo request require an internet connection.

## Prototype sign-in

Use any of these managed accounts with any password of at least six characters:

| Name | Email | Role |
| --- | --- | --- |
| Cale | `admin@bfp.gov.ph` | BFP Administrator |
| Josh Lewis | `prevention@bfp.gov.ph` | Fire Prevention / Planning |
| John Earth | `operations@bfp.gov.ph` | Operations / Response |
| Benedict Josef | `analyst@bfp.gov.ph` | Data Analyst |

The client-side login is a **prototype mock**. It only simulates a session in browser storage; it does not authenticate credentials or provide production security. Real authentication and authorization must be implemented by the backend.

## Mock and real API modes

`assets/js/api/config.js` defines `API_BASE_URL` and `USE_MOCKS`. `USE_MOCKS` is `true` by default. Mock requests return correctly shaped empty data after a 400–700 ms delay, except the managed-user list, which contains the four accounts above. Mock account mutations remain read-only.

To use the REST-style requests instead, configure a backend and set `USE_MOCKS` to `false` in `assets/js/api/config.js`. The current paths, methods, payloads, and response shapes are recorded in [docs/API_CONTRACT.md](./docs/API_CONTRACT.md); they are the static client’s working contract and still require backend confirmation.

## Structure

- `assets/css/` — design tokens, shell, shared controls, page styles, and accessibility overrides.
- `assets/js/core/` — mock auth, route permissions, shell, and state helpers.
- `assets/js/ui/` — shared controls, dialogs, empty states, tables, gauges, and feedback.
- `assets/js/maps/` and `assets/js/charts/` — lazy-loaded Leaflet and Chart.js helpers.
- `assets/js/api/` — mock/REST data services.
- `assets/js/pages/` — one page module for each converted page.
- `assets/js/utils/` — CSV, formatting, DOM, risk simulation, and browser helpers.
- `assets/vendor/` — locally bundled third-party libraries and their licenses.
- `tests/` — dependency-free logic and static-document checks using Node’s built-in test runner.
- `docs/` — conversion rules, source inventory, parity notes, and the static client API contract.

Run the checks from this directory with `node --test tests/`. No React files are used or modified by this static site.