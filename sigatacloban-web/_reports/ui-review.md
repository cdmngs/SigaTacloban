# SigaTacloban visual review

## Review setup

- App served locally at `http://127.0.0.1:8765/`.
- Screenshots are saved in [`screenshots/`](./screenshots/).
- Existing visual references in `docs/design/` were not present in this checkout. The visual comparison therefore used the shared CSS and prior style guidance under `docs/`.
- Browser screenshots and element measurements confirmed the following issues before changes.

## Findings before fixes

| ID | Page | Width | Element selector | Problem | Severity | Planned fix | Status |
|---|---|---:|---|---|---|---|---|
| UI-01 | Risk Map | 375px | `.prediction-timeline`, `.leaflet-control-attribution` | The bottom-centered timeline overlaps the map attribution at the lower right, obscuring part of the OpenStreetMap credit. | Medium | Raise the timeline within the map at mobile widths, leaving the attribution clear. | Open |
| UI-02 | Incidents | 1440px | `.incident-table-scroll`, `.incident-table`, `html` | The table’s 434px minimum content extends through the 310px scroller and causes document horizontal overflow (document scroll width 1499px vs. 1425px client width). The severity/actions end of the table is clipped at the right edge. | High | Contain the table’s horizontal scrolling in its card and clip only horizontal overflow at the shared document shell, preserving the table scroller. | Open |
| UI-03 | Alerts / Alert rules | 1440px | `.modal-panel.alert-rules-modal > .dialog-copy`, `.modal-panel.alert-rules-modal` | The modal is fixed at 760px tall while the rules content uses flex growth, leaving a large unused vertical gap between the last recipient option and the footer. | Low | Let the modal use its content height up to the existing viewport cap; keep the content region scrollable on short viewports. | Open |

## Capture inventory

The page screenshots are named `<page>-<width>.png`. Modal screenshots are named `<surface>-<width>.png`. Role variants, empty/loading/error states, and any screenshot that could not be captured reliably are listed below after the browser pass.

## Needs decision

- None identified. No markup or logic restructuring is needed for the listed fixes.

## Final status

Pending visual fixes and responsive recheck.
