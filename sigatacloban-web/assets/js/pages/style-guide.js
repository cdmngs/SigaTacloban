import { createCard } from "../ui/card.js";
import { createRiskChip } from "../ui/risk-chip.js";
import { renderGauge } from "../ui/gauge.js";
import { renderRiskDna } from "../ui/risk-dna-bars.js";
import { renderDataTable } from "../ui/table.js";
import { connectSlider } from "../ui/slider.js";
import { connectToggle } from "../ui/toggle.js";
import { openBottomSheet, openConfirm, openDrawer, openOverlay } from "../ui/overlays.js";
import { showToast } from "../ui/toast.js";
import { iconSvg } from "../ui/icons.js";

const families = {
  "coffee bean": { 100: "#070200", 200: "#0E0400", 300: "#150601", 400: "#1C0801", 500: "#220901", 600: "#7F2304", 700: "#DB3C07", 800: "#F97447", 900: "#FCB9A3", DEFAULT: "#220901" },
  "dark garnet": { 100: "#140502", 200: "#280903", 300: "#3B0E05", 400: "#4F1306", 500: "#621708", 600: "#AE290E", 700: "#ED421F", 800: "#F3816A", 900: "#F9C0B4", DEFAULT: "#621708" },
  oxblood: { 100: "#1D0602", 200: "#3A0B05", 300: "#581107", 400: "#751609", 500: "#941B0C", 600: "#D32811", 700: "#EF513C", 800: "#F48B7D", 900: "#FAC5BE", DEFAULT: "#941B0C" },
  "rusty spice": { 100: "#250B02", 200: "#4A1603", 300: "#702105", 400: "#952C06", 500: "#BC3908", 600: "#F54A0C", 700: "#F77749", 800: "#FAA586", 900: "#FCD2C2", DEFAULT: "#BC3908" },
  orange: { 100: "#352302", 200: "#6A4604", 300: "#9F6907", 400: "#D48D09", 500: "#F6AA1C", 600: "#F7BB4B", 700: "#F9CC78", 800: "#FBDDA5", 900: "#FDEED2", DEFAULT: "#F6AA1C" },
};
const semantic = [
  ["Danger", "#941B0C"], ["Info highlight", "#F6AA1C"], ["Risk: low", "#2E9E5B"],
  ["Risk: moderate", "#F4C430"], ["Risk: high", "#F77F00"], ["Risk: very high", "#D62828"],
];
const examples = [
  { name: "Barangay 77", district: "Downtown", score: 82 },
  { name: "Barangay 88", district: "Abucay", score: 78 },
];
const columns = [{ key: "name", label: "Barangay" }, { key: "district", label: "District" }, { key: "score", label: "Risk score" }];

function makeSwatch(label, color) {
  const swatch = document.createElement("div");
  swatch.className = "swatch";
  const colorBlock = document.createElement("i");
  colorBlock.style.backgroundColor = color;
  const name = document.createElement("b");
  name.textContent = label;
  const hex = document.createElement("small");
  hex.textContent = color;
  swatch.append(colorBlock, name, hex);
  return swatch;
}

function renderPalette(root) {
  const palette = root.querySelector(".palette-families");
  for (const [name, shades] of Object.entries(families)) {
    const family = document.createElement("section");
    family.className = "palette-family";
    const heading = document.createElement("h3");
    heading.textContent = name;
    const grid = document.createElement("div");
    grid.className = "swatch-grid";
    for (const [shade, color] of Object.entries(shades)) grid.append(makeSwatch(shade.toUpperCase() === "DEFAULT" ? "DEFAULT" : shade, color));
    family.append(heading, grid);
    palette.append(family);
  }
  const semanticRoot = root.querySelector(".semantic-swatches");
  for (const [name, color] of semantic) semanticRoot.append(makeSwatch(name, color));
}

function renderStats(root) {
  const cards = root.querySelector(".mini-stat-grid");
  const stats = [["flame", "Total incidents", "248", "+12 this month", "accent"], ["map", "Active stations", "9", "92% operational", "success"]];
  for (const [icon, label, value, detail, color] of stats) {
    const card = createCard(`guide-stat stat-card stat-${color}`);
    const copy = document.createElement("div");
    copy.className = "stat-copy";
    const mark = document.createElement("span");
    mark.className = "stat-icon";
    mark.innerHTML = iconSvg(icon, 18);
    const text = document.createElement("div");
    const name = document.createElement("small");
    name.textContent = label;
    const number = document.createElement("strong");
    number.textContent = value;
    const note = document.createElement("small");
    note.className = "stat-detail";
    note.textContent = detail;
    text.append(name, number, note);
    copy.append(mark, text);
    const spark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    spark.setAttribute("class", "stat-spark");
    spark.setAttribute("viewBox", "0 0 112 34");
    spark.setAttribute("aria-hidden", "true");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    line.setAttribute("points", "0,14 12,18 24,16 37,22 50,18 62,25 75,21 87,28 100,24 112,32");
    spark.append(line);
    card.append(copy, spark);
    cards.append(card);
  }
}

export function mount(main) {
  main.innerHTML = `
    <div class="style-guide-page">
      <header class="page-heading"><div><span class="eyebrow">PRODUCT FOUNDATION</span><h1>SigaTacloban design system</h1><p>Reusable visual language for trustworthy, data-rich government technology.</p></div></header>
      <section class="surface-card guide-card tokens-card"><span class="eyebrow">BRAND &amp; SEMANTIC TOKENS</span><h2>Color families · 100–900</h2><div class="palette-families"></div><div class="semantic-swatches"></div></section>
      <div class="guide-columns">
        <section class="surface-card guide-card type-card"><span class="eyebrow">POPPINS + INTER</span><h2>Typography</h2><h3>Display heading</h3><h4>Section heading</h4><p>Body text is optimized for data-dense interfaces and long-form explanations.</p><small class="guide-label-example">LABELS &amp; METADATA · 12</small><div class="logo-demo"><span class="brand-lockup"><img class="brand-icon" src="assets/img/logo.png" alt="SigaTacloban" width="36" height="36"><span class="brand-type"><strong>SigaTacloban</strong></span></span><img class="brand-icon" src="assets/img/logo.png" width="36" height="36" alt="SigaTacloban icon"></div></section>
        <section class="surface-card guide-card component-card"><span class="eyebrow">INTERACTIVE PRIMITIVES</span><h2>Components</h2><div class="button-demo"><button class="button button-primary button-sm" type="button">Primary action</button><button class="button button-secondary button-sm" type="button">Secondary</button><span class="risk-chip-row"></span></div><div class="icon-demo">${["thermometer", "pin", "chart", "wind", "shield", "rain", "droplet", "users", "map", "layers"].map((name) => `<button class="icon-button guide-icon" type="button" aria-label="Example ${name} icon">${iconSvg(name, 16)}</button>`).join("")}</div></section>
      </div>
      <div class="guide-columns guide-components">
        <section class="surface-card guide-card gauge-demo"><span class="eyebrow">RISK VISUALIZATION</span><h2>Risk score</h2><div data-gauge></div></section>
        <section class="surface-card guide-card"><span class="eyebrow">MODEL EXPLANATION</span><h2>Risk DNA</h2><div data-risk-dna></div></section>
      </div>
      <div class="guide-columns">
        <section class="surface-card guide-card"><span class="eyebrow">DATA DISPLAY</span><h2>Statistics &amp; table</h2><div class="mini-stat-grid"></div><div data-example-table></div></section>
        <section class="surface-card guide-card control-demo"><span class="eyebrow">FORM CONTROLS</span><h2>Input primitives</h2><button class="toggle-control" type="button" role="switch" aria-checked="true" aria-label="Enable risk notifications"><i></i></button><span class="toggle-copy">Risk notifications <b data-toggle-copy>on</b></span><div class="slider-field"><label for="impact-slider"><b>Weather impact</b><output data-slider-output>62%</output></label><input id="impact-slider" type="range" min="0" max="100" value="62"></div><div class="filter-row"><button class="filter-chip" type="button">${iconSvg("search",14)} Tacloban City</button><button class="filter-chip" type="button">Last 30 days</button><button class="text-action" type="button" data-reset>Reset filters</button></div><div class="skeleton-demo"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></section>
      </div>
      <div class="guide-columns">
        <section class="surface-card guide-card"><span class="eyebrow">FEEDBACK &amp; EMPTY STATES</span><h2>System messages</h2><div class="empty-state" role="status"><span aria-hidden="true">${iconSvg("file",16)}</span><strong>No reports yet</strong><p>Generated reports will appear here.</p></div><div class="feedback-actions"><button class="button button-secondary button-sm" type="button" data-toast="success">Success toast</button><button class="button button-secondary button-sm" type="button" data-toast="error">Error toast</button><button class="button button-secondary button-sm" type="button" data-toast="info">Info toast</button></div></section>
        <section class="surface-card guide-card"><span class="eyebrow">OVERLAYS &amp; ACTIONS</span><h2>Dialogs and sheets</h2><div class="feedback-actions overlay-actions"><button class="button button-secondary button-sm" type="button" data-overlay="modal">Open modal</button><button class="button button-secondary button-sm" type="button" data-overlay="drawer">Open drawer</button><button class="button button-secondary button-sm" type="button" data-overlay="sheet">Open bottom sheet</button><button class="button button-secondary button-sm" type="button" data-overlay="confirm">Confirm dialog</button></div><p class="overlay-note">Focus-trapped overlays dismiss with Escape or an outside click.</p></section>
      </div>
    </div>`;
  renderPalette(main);
  renderStats(main);
  const chips = main.querySelector(".risk-chip-row");
  for (const level of ["low", "moderate", "high", "veryhigh"]) chips.append(createRiskChip(level));
  renderGauge(main.querySelector("[data-gauge]"), 82);
  renderRiskDna(main.querySelector("[data-risk-dna]"));
  renderDataTable(main.querySelector("[data-example-table]"), columns, examples);

  const toggle = main.querySelector(".toggle-control");
  connectToggle(toggle, (enabled) => { main.querySelector("[data-toggle-copy]").textContent = enabled ? "on" : "off"; });
  connectSlider(main, { inputSelector: "#impact-slider", outputSelector: "[data-slider-output]" });
  main.querySelector("[data-reset]").addEventListener("click", () => {
    main.querySelector("#impact-slider").value = "50";
    main.querySelector("[data-slider-output]").textContent = "50%";
  });
  const messages = { success: "Changes saved successfully.", error: "Unable to load incident data.", info: "Risk level updated." };
  main.querySelectorAll("[data-toast]").forEach((button) => button.addEventListener("click", () => showToast(messages[button.dataset.toast], button.dataset.toast)));
  main.querySelectorAll("[data-overlay]").forEach((button) => button.addEventListener("click", () => {
    const mode = button.dataset.overlay;
    const options = {
      title: mode === "drawer" ? "Incident details" : mode === "sheet" ? "Quick actions" : mode === "confirm" ? "Confirm action" : "Sample dialog",
      message: mode === "drawer" ? "Drawer content stays close to the page context." : mode === "sheet" ? "Export a summary or return to the design guide." : mode === "confirm" ? "Are you sure you want to continue?" : "A focused modal for a decision or short form.",
      confirmLabel: mode === "confirm" ? "Continue" : mode === "sheet" ? "Export summary" : "Done",
    };
    if (mode === "confirm") openConfirm({ ...options, onConfirm: () => showToast("Action confirmed.") });
    else if (mode === "drawer") openDrawer(options);
    else if (mode === "sheet") openBottomSheet(options);
    else openOverlay(options);
  }));
}
