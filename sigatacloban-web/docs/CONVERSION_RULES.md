# SigaTacloban static conversion rules

Every later phase must follow these rules:

1. The React code is the source of truth (it holds all the latest changes); screenshots in `docs/design` show the current look. Match the current React app exactly: layouts, spacing, colors, typography, icons, text, states, role permissions and behavior, including current visual bugs (Phase 6 fixes them).
2. Brand name is exactly "SigaTacloban" (no subtitle), using `public/logo.png` (copy it to `assets/img/logo.png`; do not edit it). Document titles use "Page name · SigaTacloban". The top bar shows only the bold page title, bell and profile (no logo).
3. Removed features stay removed: roads, buildings and geographic features, land use, population density, global top-bar search and command palette, dark map, seasonal/five-year chart.
4. No sample data: zeros, dashes, empty charts and lists, full layouts kept, empty data is NOT an error, and empty states live inside cards. Only a real failed request shows the error state with Retry.
5. Only the 4 accounts exactly as in the current React auth store/config (Cale, Josh Lewis, John Earth, Benedict Josef; admin@, prevention@, operations@, analyst@bfp.gov.ph; any password of 6+ characters), with the current permissions from the config folder.
6. Risk colors stay semantic: Low #2E9E5B, Moderate #F4C430, High #F77F00, Very High #D62828. Disclaimer on risk pages: "Risk estimates, not exact predictions of future fires."
7. Z-index scale in CSS variables: map 0 (isolation: isolate), top bar 30, sidebar 40, floating map panels 500, drawer/sheet 1100, modal 1200, toast 1300. Modals use a fixed full-viewport backdrop, body scroll lock, focus trap and Esc.
8. Escape all dynamic text (textContent or escapeHtml); no inline event handlers, no eval.
9. Responsive at 390 / 768 / 1440; render the real table OR the stacked cards, never both; the sidebar becomes a bottom tab bar with a "More" sheet on mobile.
10. The client-side login is a MOCK; real authentication will be done by the backend (say so in `auth.js` and the README).
