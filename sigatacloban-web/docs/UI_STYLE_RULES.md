# UI Style Rules (Step 1 Baseline)

Reference: `trends.html`, rendered at 1920×1080, browser zoom 100%, display scale 100%. The browser reported `devicePixelRatio = 1`, `visualViewport.scale = 1`, `innerWidth = 1920`, and `innerHeight = 1080`; this run is valid. Values below come from `getComputedStyle` and bounding boxes unless marked CSS/source-derived. No production page styles were changed in this step.

## Measured Trends Values

| Token name | Value | Where Trends uses it |
|---|---:|---|
| `--ui-font-family-body` | `Inter, sans-serif` | Subtitle, labels, controls, sidebar |
| `--ui-font-family-heading` | `Poppins, sans-serif` | Page and card headings |
| `--ui-text-topbar-title` | `16px`, weight `600` | Topbar label, 20px rendered line box |
| `--ui-text-eyebrow` | `10px`, weight `700`, line-height `14px` observed; **11px proposed** | Pattern Intelligence eyebrow; ranking eyebrow source rule is 7px |
| `--ui-text-page-title` | `21px`, weight `500` | “Fire risk trends”; 31px rendered line box |
| `--ui-text-caption` | `10px` subtitle, `7px` KPI label/delta, `9px` chart labels observed; **11px proposed** | Subtitle, KPI details, chart legend/ticks |
| `--ui-text-stat-number` | `17px`, weight `600` | KPI number |
| `--ui-text-card-title` | `12px`, weight `500` | “Barangay ranking” and “Historical vs predicted” |
| `--ui-text-empty-title` | `14px`, weight `700` | Shared Trends empty-state heading |
| `--ui-text-empty-detail` | `12px` observed; **11px proposed** | Shared empty-state explanatory line |
| `--ui-text-chip` | `No chip rendered on Trends` | Derived as 11px body text |
| `--ui-text-button` | Export button `8px`, weight `600` observed; **11px proposed** | Export CSV |
| `--ui-text-select` | `9px`, weight `500` observed; **11px proposed** | Last 12 months select |
| `--ui-text-display` | Not used on Trends | Reserved only for weather hero temperature and gauge score; 32px proposed |
| `--ui-font-weights` | `400`, `500`, `600`, `700` | Observed in normal/body, card, action, and eyebrow styles |
| `--ui-control-height-measured` | `32px` | Export CSV button and period select |
| `--ui-control-height` | `36px` proposed | Accessibility adjustment: all targets must be at least 36px; this is 4px above Trends |
| `--ui-control-compact-height` | `36px` proposed | Compact controls still cannot violate the 36px target floor |
| `--ui-control-radius` | `8px` | Select and Export CSV |
| `--ui-card-padding` | `14px` | Chart and ranking cards |
| `--ui-card-radius` | `16px` | Trends chart card |
| `--ui-card-shadow` | `0 8px 24px rgba(34,9,1,.08)` | Trends chart card |
| `--ui-kpi-padding` | `12px 14px` | KPI card |
| `--ui-kpi-inner-gap` | `5px` | KPI label, number and delta stack |
| `--ui-card-gap` | `12px` | KPI grid and chart grid |
| `--ui-header-card-gap` | `15px` | Page heading bottom margin before KPI cards |
| `--ui-empty-icon-tile` | `25px` | Shared empty-state tile enclosing the 16px icon |
| `--ui-avatar-size` | `32px` proposed | Derived compact identity marker size |
| `--ui-slider-thumb-size` | `16px` proposed | Derived usable slider thumb size |
| `--ui-tap-target` | `36px` minimum | Explicit accessibility requirement; shared with control height |
| `--ui-page-content-padding` | `25px 26px 34px` | `.page-content` at 1920×1080 |
| `--ui-page-content-max-width` | `1400px` | `.phase3-page`, centered at x=360 to x=1760 |
| `--ui-sidebar-item-text` | `11px`, weight `500`; item height `32px` | Sidebar navigation |
| `--ui-icon-sidebar` | `16×16px`, SVG explicit width/height | Sidebar item icon |
| `--ui-icon-stat-delta` | `12×12px` | KPI delta arrow |
| `--ui-icon-export` | `14×14px` | Export CSV icon |
| `--ui-icon-empty-state` | `16×16px`, inside a `25×25px` tile | Shared empty-state icon |
| `--ui-icon-stroke` | `2` | Inline SVG icon convention; SVG `stroke-width` attribute may be inherited |
| `--ui-color-text-primary` | `#220901` | Titles and KPI values |
| `--ui-color-text-muted` | `#6E5B52` | Subtitle, muted labels and empty detail |
| `--ui-color-surface` | `#FFFFFF` | Cards and controls |
| `--ui-color-canvas` | `#FBF7F3` | Page background |
| Risk colors | Low `#2E9E5B`; Moderate `#F4C430`; High `#F77F00`; Very High `#D62828` | Semantic risk states (preserved) |

The chart legend and Y-axis tick labels are rendered by Chart.js on canvas, so their actual computed canvas glyphs cannot be read with DOM `getComputedStyle`. Their config now reads the shared 11px body token. The measured empty detail is 12px; the unified caption rule is 11px.

## Derived Component Rules

These do not exist on Trends and therefore are proposals, not measurements:

| Component | Proposed token/rule | Reasoning |
|---|---|---|
| Table | Body 11px cells; 11px secondary email/unit lines; 11px headers | Same readable body/caption floor as adjusted Trends |
| Forms | 11px labels, placeholders and values; 36px controls; 8px radius | Reuse button/select rhythm while meeting 36px target minimum |
| Tabs and toggles | 11px labels; 36px minimum interactive height; 8px radius | Same body and control targets |
| Slider | 11px label/value; 36px enclosing row target; 16px thumb | Same text/control rules; thumb is a usable hit target |
| Pagination | 11px text; 36px action buttons; 8px radius | Compact visual grouping without undersized taps |
| Avatar | 32px avatar box; 11px initials | Neutral derived size matching other compact controls |
| Modal/drawer | 12px heading, 11px body, 14px padding, 16px radius, white surface/border/shadow | Match Trends card header and surface container |
| Toast | 11px body, 8px radius, same card border/shadow | Same body and control radius |
| Chip | 11px text, 30px pill radius, 36px minimum tap height when interactive | Inert chips may remain visually shorter; interactive chips meet target floor |
| Icons | Only 12px, 14px, 16px; explicit square dimensions; stroke width 2 | Sizes observed on Trends; icon sizing must not be inferred from font-size |
| Display text | 32px only for weather hero temperature and gauge score | Sole intentional display-size exception |

Allowed fixed type scale: 11px body/caption/eyebrow/chip/button/table text, 12px card title, 14px empty-state title, 16px topbar, 17px stat number, 21px page title, and 32px display exception. The 14px empty-state heading and 16px topbar are distinct measured Trends roles; they are retained rather than folded into another category. All measured Trends text below 11px is now 11px, an intentional deviation from the raw screenshot baseline. All tappable controls are 36px high rather than the measured 32px Trends select/button, the explicit minimum-target requirement wins.

## Fixed-Scale and Contrast Requirements

The document root remains exactly 16px. Do not add `zoom`, layout scaling transforms, viewport-based font sizes, or viewport-dependent font scaling. Set `text-size-adjust:100%`; allow layout reflow only. Fixed pixel dimensions replace prior transform scaling on the dashboard/What-If gauges and selected map markers. `clamp()` remains only for responsive map heights in the existing operational layout tokens; it is not used for typography. Preserve the existing brand, palette, risk colors, OpenStreetMap maps and z-index scale in `CONVERSION_RULES.md`.

Text pairings must meet WCAG AA: 4.5:1 for ordinary text and 3:1 for large text and UI boundaries. Starting pairs are primary `#220901` on white `#FFFFFF`, muted `#6E5B52` on canvas `#FBF7F3` or white, and dark-panel text `#E8D5CC` on coffee bean `#220901`. Risk colors communicate status with labels/marks, not color alone. Audit each effective rendered background; do not assume a translucent panel has the canvas color.

## UI Checklist for New Pages

- Use only the fixed type roles above; use `--ui-text-display` only for weather temperature and gauge score.
- Set SVG width and height explicitly using the 12px, 14px, or 16px icon tokens, with stroke width 2 and inherited color.
- Use `--ui-control-height` (36px), 8px control radius, and at least 36px hit targets; compact controls do not reduce the target size.
- Use `--ui-card-padding`, `--ui-card-radius`, `--ui-card-shadow`, and `--ui-gap-inline` for Trends-style card surfaces and spacing.
- Include loading, empty, error-with-Retry, and populated states; keep empty states inside their owning region.
- Verify narrow layouts at 390px and 360px, keyboard focus/active states, accessible names/alt text, AA contrast, and page edges at the relevant scrollbar state.