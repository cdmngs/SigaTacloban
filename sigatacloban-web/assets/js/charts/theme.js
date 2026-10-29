import { formatValue } from "../utils/format.js";

const colors = Object.freeze({
  brandAccent: "#BC3908", brandPrimary: "#220901", info: "#7F2304", danger: "#941B0C",
  success: "#1F653D", riskLow: "#2E9E5B", riskModerate: "#F4C430",
  riskHigh: "#F77F00", riskVeryHigh: "#D62828", grid: "#EADFD8", muted: "#6E5B52",
});
const font = Object.freeze({
  family: getComputedStyle(document.body).fontFamily || "Inter, sans-serif",
  size: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-text-body")) || 11,
});
let chartLoadPromise;
let nextSummaryId = 0;
let cleanupOnPageHideRegistered = false;

export const chartColors = colors;
export const chartFont = font;
export const chartBaseOptions = Object.freeze({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 500 },
  plugins: {
    legend: { labels: { color: colors.muted, usePointStyle: true, pointStyle: "line", boxWidth: 18, font } },
    tooltip: { backgroundColor: colors.brandPrimary, titleFont: { ...font, weight: 600 }, bodyFont: font, padding: 9, cornerRadius: 7, displayColors: true },
  },
  scales: {
    x: { grid: { display: false }, border: { display: false }, ticks: { color: colors.muted, font, maxRotation: 0 } },
    y: { border: { display: false, dash: [3, 4] }, grid: { color: colors.grid }, ticks: { color: colors.muted, font, maxTicksLimit: 5 } },
  },
});

export function describeChart(canvas, label, summary) {
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", formatValue(label, "Chart"));
  const chartCard = canvas.closest(".chart-card");
  let summaryElement = chartCard?.querySelector(".chart-data-summary");
  if (!summaryElement) {
    summaryElement = document.createElement("p");
    summaryElement.className = "chart-data-summary visually-hidden";
    canvas.parentElement?.append(summaryElement);
  }
  if (!summaryElement.id) summaryElement.id = `chart-data-summary-${++nextSummaryId}`;
  summaryElement.textContent = formatValue(summary, "No chart data available.");
  canvas.setAttribute("aria-describedby", summaryElement.id);
}

function destroyChartsOnPageHide() {
  if (cleanupOnPageHideRegistered) return;
  cleanupOnPageHideRegistered = true;
  window.addEventListener("pagehide", () => {
    if (!window.Chart) return;
    for (const instance of Object.values(window.Chart.instances || {})) instance.destroy();
  }, { once: true });
}

export function loadChartJs() {
  destroyChartsOnPageHide();
  if (window.Chart) return Promise.resolve(window.Chart);
  if (chartLoadPromise) return chartLoadPromise;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "assets/css/charts.css";
  link.id = "site-chart-css";
  if (!document.getElementById(link.id)) document.head.append(link);
  chartLoadPromise = new Promise((resolve, reject) => {
    const script = document.getElementById("vendor-chart-js") || document.createElement("script");
    script.id = "vendor-chart-js";
    script.src = new URL("assets/vendor/chart.umd.js", document.baseURI).href;
    script.async = true;
    script.addEventListener("load", () => {
      if (!window.Chart) { chartLoadPromise = null; reject(new Error("Chart.js did not initialize.")); return; }
      resolve(window.Chart);
    }, { once: true });
    script.addEventListener("error", () => {
      chartLoadPromise = null;
      reject(new Error("Could not load the local Chart.js library."));
    }, { once: true });
    if (!script.isConnected) document.head.append(script);
  });
  return chartLoadPromise;
}

export function chartGradient(context, color, opacity = 0.22) {
  const { chart } = context;
  const { ctx, chartArea } = chart;
  if (!chartArea) return `${color}20`;
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, "0");
  gradient.addColorStop(0, `${color}${alpha}`);
  gradient.addColorStop(1, `${color}00`);
  return gradient;
}

export function createChartCard(container, { title, eyebrow = "", summary = "", className = "", note = "No data yet" } = {}) {
  if (!document.getElementById("site-chart-css")) {
    const link = document.createElement("link");
    link.id = "site-chart-css";
    link.rel = "stylesheet";
    link.href = "assets/css/charts.css";
    document.head.append(link);
  }
  const card = document.createElement("section");
  card.className = `surface-card chart-card ${className}`.trim();
  const heading = document.createElement("header");
  heading.className = "chart-card-heading";
  const copy = document.createElement("div");
  if (eyebrow) {
    const label = document.createElement("span");
    label.className = "eyebrow";
    label.textContent = eyebrow;
    copy.append(label);
  }
  const titleElement = document.createElement("h2");
  const formattedTitle = formatValue(title);
  titleElement.textContent = formattedTitle;
  copy.append(titleElement);
  heading.append(copy);
  const plot = document.createElement("div");
  plot.className = "chart-card-plot";
  const canvas = document.createElement("canvas");
  const empty = document.createElement("p");
  empty.className = "chart-empty-note";
  empty.textContent = formatValue(note);
  plot.append(canvas, empty);
  const summaryElement = document.createElement("p");
  summaryElement.className = "visually-hidden";
  summaryElement.setAttribute("aria-label", "Chart data summary");
  summaryElement.textContent = formatValue(summary);
  summaryElement.classList.add("chart-data-summary");
  card.append(heading, plot, summaryElement);
  container.append(card);
  describeChart(canvas, formattedTitle, summary);
  return {
    card, canvas, emptyNote: empty, summary: summaryElement,
    setHasData(hasData) {
      empty.hidden = Boolean(hasData);
      empty.style.display = hasData ? "none" : "grid";
    },
  };
}

function hasChartPoints(data) {
  return Array.isArray(data?.datasets) && data.datasets.some((dataset) =>
    Array.isArray(dataset.data) && dataset.data.some((value) => value !== null && value !== undefined && Number.isFinite(Number(value))),
  );
}

function chartEmptyNote(canvas, message) {
  let note = canvas.closest(".chart-card-plot")?.querySelector(".chart-empty-note");
  if (!note) {
    note = document.createElement("p");
    note.className = "chart-empty-note";
    canvas.parentElement?.append(note);
    if (canvas.parentElement && getComputedStyle(canvas.parentElement).position === "static") canvas.parentElement.style.position = "relative";
  }
  note.textContent = formatValue(message);
  note.hidden = false;
  note.style.display = "grid";
  return note;
}

export function renderChart(canvas, configuration, { emptyMessage = "No data yet" } = {}) {
  destroyChartsOnPageHide();
  const Chart = window.Chart;
  if (!Chart) throw new Error("Chart.js is not loaded. Load assets/vendor/chart.umd.js first.");
  if (!configuration || typeof configuration !== "object") throw new TypeError("A Chart.js configuration is required.");
  const previous = Chart.getChart?.(canvas);
  previous?.destroy();
  const hasData = hasChartPoints(configuration.data);
  const note = chartEmptyNote(canvas, emptyMessage);
  if (!hasData) {
    describeChart(canvas, canvas.getAttribute("aria-label") || "Chart", emptyMessage);
    return null;
  }
  if (note) {
    note.hidden = true;
    note.style.display = "none";
  }
  const instance = new Chart(canvas, configuration);
  const pointCount = configuration.data.labels?.length || 0;
  describeChart(canvas, canvas.getAttribute("aria-label") || "Chart", `${formatValue(pointCount)} data points.`);
  return instance;
}

export function renderEmptyChart(canvas, { type = "line", options = {}, emptyMessage = "No data yet" } = {}) {
  destroyChartsOnPageHide();
  const Chart = window.Chart;
  if (!Chart) throw new Error("Chart.js is not loaded. Load assets/vendor/chart.umd.js first.");
  Chart.getChart?.(canvas)?.destroy();
  chartEmptyNote(canvas, emptyMessage);
  describeChart(canvas, canvas.getAttribute("aria-label") || "Chart", emptyMessage);
  const normalizedType = ["line", "bar"].includes(type) ? type : "line";
  return new Chart(canvas, {
    type: normalizedType,
    data: { labels: [], datasets: [{ label: "", data: [], borderColor: colors.brandAccent, backgroundColor: `${colors.brandAccent}20`, tension: 0.35 }] },
    options: {
      ...structuredClone(chartBaseOptions),
      ...options,
      plugins: { ...chartBaseOptions.plugins, ...options.plugins, legend: { ...chartBaseOptions.plugins.legend, display: false, ...options.plugins?.legend } },
      scales: { ...chartBaseOptions.scales, ...options.scales },
    },
  });
}
