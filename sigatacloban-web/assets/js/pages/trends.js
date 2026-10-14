import { fetchTrends } from "../api/trends.js";
import { fetchRiskAreas } from "../api/risk.js";
import { loadChartJs, chartBaseOptions, chartColors, chartGradient, describeChart } from "../charts/theme.js";
import { downloadCsv } from "../utils/csv.js";
import { escapeHtml } from "../utils/dom.js";
import { iconSvg } from "../ui/icons.js";
import { createEmptyState } from "../ui/empty-state.js";

const styles = ["phase3-pages.css", "trends.css", "phase3-responsive.css"];
const periods = [["3m", "Last 3 months"], ["6m", "Last 6 months"], ["12m", "Last 12 months"], ["ytd", "Year to date"]];
function ensureStyles() {
  for (const file of styles) {
    const id = `phase3-${file}`;
    if (document.getElementById(id)) continue;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet"; link.href = `assets/css/${file}`; document.head.append(link);
  }
}
function showError(main, retry) {
  main.innerHTML = `<div class="phase3-page"><div class="query-error" role="alert"><b>Trend data could not be loaded.</b><button type="button" class="button button-primary">Retry</button></div></div>`;
  main.querySelector("button").addEventListener("click", retry);
}
export async function mount(main) {
  ensureStyles();
  main.innerHTML = `<div class="phase3-page phase3-loading"><div class="skeleton phase3-title-skeleton"></div><div class="trend-skeleton-kpis">${Array.from({ length: 4 }, () => '<div class="skeleton"></div>').join("")}</div><div class="trend-skeleton-panels"><div class="skeleton"></div><div class="skeleton"></div></div></div>`;
  await load(main, "12m");
}
async function load(main, period) {
  try {
    const [trends, areas] = await Promise.all([fetchTrends(period), fetchRiskAreas()]);
    render(main, period, trends, areas);
  } catch { showError(main, () => load(main, period)); }
}
function render(main, period, data, areas) {
  const kpis = data.kpis ?? { incidentsYtd: 0, incidentsChangePercent: 0, averageRisk: 0, averageRiskChangePercent: 0, peakMonth: "—", peakMonthIncidents: 0, forecastTrend: "—", forecastChangePercent: 0 };
  const ranked = [...areas].sort((a, b) => b.score - a.score).slice(0, 5);
  main.innerHTML = `<div class="phase3-page trends-page"><header class="phase3-heading"><div><span class="eyebrow">PATTERN INTELLIGENCE</span><h1>Fire risk trends</h1><p>Explore changes in incident frequency and predicted risk.</p></div><div class="trends-header-actions"><label class="period-select"><span class="visually-hidden">Trend period</span><select>${periods.map(([value, label]) => `<option value="${value}"${period === value ? " selected" : ""}>${label}</option>`).join("")}</select></label><button class="button button-secondary export-csv-button" type="button" ${data.points.length ? "" : "disabled"}>${iconSvg("file", 14)}Export CSV</button></div></header>
    <div class="trend-kpis">${[
      ["Incidents YTD", kpis.incidentsYtd, `${kpis.incidentsChangePercent > 0 ? "+" : ""}${kpis.incidentsChangePercent}%`, "bad", true],
      ["Avg. risk score", kpis.averageRisk, `${kpis.averageRiskChangePercent}%`, "good", false],
      ["Peak month", kpis.peakMonth, `${kpis.peakMonthIncidents} incidents`, "bad", true],
      ["Forecast trend", kpis.forecastTrend, `${kpis.forecastChangePercent > 0 ? "+" : ""}${kpis.forecastChangePercent}%`, "bad", true],
    ].map(([label, value, change, tone, up]) => `<article class="surface-card trend-kpi trend-${tone}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${iconSvg("arrow", 12)}${escapeHtml(change)}</span></article>`).join("")}</div>
    <div class="trend-charts-grid"><section class="surface-card chart-card trend-line-card"><header class="chart-card-heading"><div><span class="eyebrow">MONTHLY RISK SCORE</span><h2>Historical vs predicted</h2></div></header><div class="trend-line-wrap"><canvas aria-label="Historical and predicted monthly risk scores" role="img"></canvas></div>${data.points.length ? "" : '<div class="trend-empty-state"></div>'}</section>
      <section class="surface-card barangay-ranking-card"><div class="ranking-heading"><span class="eyebrow">AVERAGE RISK SCORE</span><h2>Barangay ranking</h2></div>${ranked.length ? `<ol class="barangay-ranking">${ranked.map((area, index) => `<li><a href="risk-map.html?area=${encodeURIComponent(area.id)}"><span class="ranking-number">${index + 1}</span><span class="ranking-name">${escapeHtml(area.name)}</span><span class="ranking-track"><i style="width:${Math.max(0, Math.min(100, Number(area.score) || 0))}%"></i></span><b>${area.score}</b></a></li>`).join("")}</ol>` : '<div class="trend-ranking-empty"></div>'}</section></div></div>`;
  main.querySelector(".trend-empty-state")?.replaceChildren(createEmptyState("No trend data", "Historical and predicted trends will appear here.", "chart"));
  main.querySelector(".trend-ranking-empty")?.replaceWith(createEmptyState("No barangay ranking", "Barangay rankings appear when risk data is available.", "map"));
  main.querySelector(".period-select select").addEventListener("change", (event) => { void load(main, event.target.value); });
  main.querySelector(".export-csv-button").addEventListener("click", () => {
    if (!data.points.length) return;
    downloadCsv(`sigatacloban-trends-${period}.csv`, ["Month", "Historical risk", "Predicted risk"], data.points.map((point) => [point.month, point.historical, point.predicted]));
  });
  void drawChart(main.querySelector("canvas"), data.points);
}
async function drawChart(canvas, points) {
  const Chart = await loadChartJs();
  const summary = points.length
    ? points.map((point) => `${point.month ?? "Month"}: historical ${Number.isFinite(Number(point.historical)) ? Number(point.historical) : "unavailable"}, predicted ${Number.isFinite(Number(point.predicted)) ? Number(point.predicted) : "unavailable"}`).join("; ")
    : "No historical or predicted trend data is available.";
  describeChart(canvas, "Historical and predicted monthly risk scores", summary);
  new Chart(canvas, {
    type: "line",
    data: { labels: points.map((point) => point.month), datasets: [
      { label: "Historical", data: points.map((point) => point.historical), borderColor: chartColors.info, backgroundColor: (context) => chartGradient(context, chartColors.info, 0.12), fill: true, tension: 0.33, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4 },
      { label: "Predicted", data: points.map((point) => point.predicted), borderColor: chartColors.brandAccent, backgroundColor: (context) => chartGradient(context, chartColors.brandAccent, 0.12), fill: "-1", tension: 0.33, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4 },
    ] },
    options: { ...chartBaseOptions, plugins: { ...chartBaseOptions.plugins, legend: { ...chartBaseOptions.plugins.legend, position: "top", align: "start" } }, scales: { ...chartBaseOptions.scales, y: { ...chartBaseOptions.scales.y, min: 0, max: 100, ticks: { ...chartBaseOptions.scales.y.ticks, stepSize: 20 } } } },
  });
}
