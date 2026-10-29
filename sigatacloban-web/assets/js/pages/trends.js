import { fetchTrends, fetchTrendBarangays, exportTrends } from "../api/trends.js";
import { fetchRiskAreas } from "../api/risk.js";
import { loadChartJs, chartBaseOptions, chartColors, chartGradient, describeChart } from "../charts/theme.js";
import { downloadCsv } from "../utils/csv.js";
import { escapeHtml } from "../utils/dom.js";
import { iconSvg } from "../ui/icons.js";
import { createEmptyState } from "../ui/empty-state.js";
import { loadData } from "../core/data-state.js";
import { subscribeToSharedData } from "../core/store.js";
import { formatNumber, formatValue } from "../utils/format.js";

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

export async function mount(main) {
  ensureStyles();
  main.innerHTML = `<div class="phase3-page phase3-loading"><div class="skeleton phase3-title-skeleton"></div><div class="trend-skeleton-kpis">${Array.from({ length: 4 }, () => '<div class="skeleton"></div>').join("")}</div><div class="trend-skeleton-panels"><div class="skeleton"></div><div class="skeleton"></div></div></div>`;
  const filters = { period: "12m", areaId: new URLSearchParams(location.search).get("area") || "" };
  const load = loadData(async (period, areaId, signal) => {
    const [trends, ranking, areas] = await Promise.all([
      fetchTrends(period, { areaId, signal }),
      fetchTrendBarangays(period, 5, { areaId, signal }),
      fetchRiskAreas({ signal }),
    ]);
    return { trends, ranking, areas };
  }, [filters.period, filters.areaId], {
    container: main,
    emptyTitle: "No trend data",
    emptyMessage: "No trend data is available for this filter.",
    errorTitle: "Trend data could not be loaded",
    success: (_container, data) => render(main, data, load, filters),
  });
  subscribeToSharedData("incidentRefreshAt", (timestamp) => {
    if (timestamp) void load.load([filters.period, filters.areaId]);
  });
  await load.load();
}

function render(main, { trends, ranking, areas }, loader, filters) {
  const data = trends || {};
  const kpis = data.kpis || {};
  const points = Array.isArray(data.points) ? data.points : [];
  const ranked = Array.isArray(ranking) ? ranking : [];
  const period = filters.period || data.period || "12m";
  const areaId = filters.areaId || "";
  main.innerHTML = `<div class="phase3-page trends-page"><header class="phase3-heading"><div><span class="eyebrow">PATTERN INTELLIGENCE</span><h1>Fire risk trends</h1><p>Explore changes in incident frequency and predicted risk.</p></div><div class="trends-header-actions"><label class="period-select"><span class="visually-hidden">Trend period</span><select class="trend-period">${periods.map(([value, label]) => `<option value="${value}"${period === value ? " selected" : ""}>${label}</option>`).join("")}</select></label><label class="period-select trend-area-select"><span class="visually-hidden">Barangay filter</span><select class="trend-area"><option value="">All barangays</option>${areas.map((area) => `<option value="${escapeHtml(area.id)}" ${areaId === area.id ? "selected" : ""}>${escapeHtml(area.name)}</option>`).join("")}</select></label><button class="button button-secondary export-csv-button" type="button" ${points.length ? "" : "disabled"}>${iconSvg("file", 14)}Export CSV</button></div></header>
    <div class="trend-kpis">${[
      ["Incidents YTD", kpis.incidentsYtd, kpis.incidentsChangePercent, "bad"],
      ["Avg. risk score", kpis.averageRisk, kpis.averageRiskChangePercent, "good"],
      ["Peak month", kpis.peakMonth, kpis.peakMonthIncidents, "bad", true],
      ["Forecast trend", kpis.forecastTrend, kpis.forecastChangePercent, "bad"],
    ].map(([label, value, change, tone, absolute]) => {
      const numericChange = Number(change);
      const indicator = absolute ? `${formatValue(change, "—")} incidents` : `${numericChange > 0 ? "+" : ""}${formatValue(change)}%`;
      const direction = Number.isFinite(numericChange) ? numericChange >= 0 ? "up" : "down" : "";
      return `<article class="surface-card trend-kpi trend-${tone}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(formatValue(value))}</strong><span class="trend-change ${direction}">${iconSvg("arrow", 12)}${escapeHtml(indicator)}</span></article>`;
    }).join("")}</div>
    <div class="trend-charts-grid"><section class="surface-card chart-card trend-line-card"><header class="chart-card-heading"><div><span class="eyebrow">MONTHLY RISK SCORE</span><h2>Historical vs predicted</h2></div></header><div class="trend-line-wrap"><canvas aria-label="Historical and predicted monthly risk scores" role="img"></canvas><div class="trend-chart-empty" hidden></div></div></section>
      <section class="surface-card barangay-ranking-card"><div class="ranking-heading"><span class="eyebrow">AVERAGE RISK SCORE</span><h2>Barangay ranking</h2></div><div class="trend-ranking-content"></div></section></div></div>`;
  const rankingSlot = main.querySelector(".trend-ranking-content");
  if (ranked.length) {
    const list = document.createElement("ol");
    list.className = "barangay-ranking";
    ranked.forEach((area, index) => {
      const score = Number(area.riskScore ?? area.score);
      const item = document.createElement("li");
      item.innerHTML = `<a href="risk-map.html?area=${encodeURIComponent(area.id)}"><span class="ranking-number">${index + 1}</span><span class="ranking-name"></span><span class="ranking-track"><i></i></span><b></b></a>`;
      item.querySelector(".ranking-name").textContent = formatValue(area.name);
      item.querySelector(".ranking-track i").style.width = `${Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0}%`;
      item.querySelector("b").textContent = formatNumber(score);
      list.append(item);
    });
    rankingSlot.replaceChildren(list);
  } else rankingSlot.replaceChildren(createEmptyState("No barangay ranking", "Barangay rankings appear when risk data is available.", "map"));
  const draw = async (rows) => {
    const Chart = await loadChartJs();
    const canvas = main.querySelector("canvas");
    Chart.getChart?.(canvas)?.destroy();
    const valid = Array.isArray(rows) ? rows : [];
    const empty = main.querySelector(".trend-chart-empty");
    if (!valid.length) {
      empty.hidden = false;
      empty.replaceChildren(createEmptyState("No trend data", "Historical and predicted trends will appear here.", "chart"));
      describeChart(canvas, "Historical and predicted monthly risk scores", "No historical or predicted trend data is available.");
      return;
    }
    empty.hidden = true;
    const summary = valid.map((point) => `${point.month ?? "Month"}: historical ${formatValue(point.historical)}, predicted ${formatValue(point.predicted)}`).join("; ");
    describeChart(canvas, "Historical and predicted monthly risk scores", summary);
    new Chart(canvas, {
      type: "line",
      data: { labels: valid.map((point) => point.month), datasets: [
        { label: "Historical", data: valid.map((point) => point.historical), borderColor: chartColors.info, backgroundColor: (context) => chartGradient(context, chartColors.info, 0.12), fill: true, tension: 0.33, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4 },
        { label: "Predicted", data: valid.map((point) => point.predicted), borderColor: chartColors.brandAccent, backgroundColor: (context) => chartGradient(context, chartColors.brandAccent, 0.12), fill: "-1", tension: 0.33, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4 },
      ] },
      options: { ...chartBaseOptions, plugins: { ...chartBaseOptions.plugins, legend: { ...chartBaseOptions.plugins.legend, position: "top", align: "start" } }, scales: { ...chartBaseOptions.scales, y: { ...chartBaseOptions.scales.y, min: 0, max: 100, ticks: { ...chartBaseOptions.scales.y.ticks, stepSize: 20 } } } },
    });
  };
  void draw(points).catch((error) => main.querySelector(".trend-chart-empty").replaceChildren(createEmptyState("Chart unavailable", formatValue(error?.message), "chart")));
  const periodSelect = main.querySelector(".trend-period");
  const areaSelect = main.querySelector(".trend-area");
  const reload = () => {
    const nextPeriod = periodSelect.value;
    const nextArea = areaSelect.value;
    filters.period = nextPeriod;
    filters.areaId = nextArea;
    const url = new URL(window.location.href);
    if (nextArea) url.searchParams.set("area", nextArea);
    else url.searchParams.delete("area");
    window.history.replaceState(null, "", url);
    void loader.load([nextPeriod, nextArea]);
  };
  periodSelect.addEventListener("change", reload);
  areaSelect.addEventListener("change", reload);
  main.querySelector(".export-csv-button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (!points.length) return;
    button.disabled = true;
    try {
      const exported = await exportTrends(period, { areaId });
      if (typeof exported === "string") {
        downloadText(exported, `sigatacloban-trends-${period}.csv`, "text/csv;charset=utf-8");
      } else if (typeof exported?.content === "string") {
        downloadText(exported.content, exported.fileName || `sigatacloban-trends-${period}.csv`, exported.contentType || "text/csv;charset=utf-8");
      } else {
        downloadCsv(`sigatacloban-trends-${period}.csv`, ["Month", "Historical risk", "Predicted risk"], points.map((point) => [point.month, point.historical, point.predicted]));
      }
    } catch (error) {
      main.dispatchEvent(new CustomEvent("app:toast", { bubbles: true, detail: { message: error.message || "Trend export failed.", type: "error" } }));
    } finally { button.disabled = false; }
  });
}

function downloadText(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.hidden = true;
  document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
