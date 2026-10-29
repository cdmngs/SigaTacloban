import { fetchDashboardSummary } from "../api/dashboard.js";
import { fetchRiskAreas, fetchCityRisk } from "../api/risk.js";
import { fetchIncidents } from "../api/incidents.js";
import { fetchStations } from "../api/stations.js";
import { fetchWeather } from "../api/weather.js";
import { createMap } from "../maps/map-view.js";
import { addMapLayers } from "../maps/layers.js";
import { loadChartJs, chartColors, chartBaseOptions, chartGradient, describeChart } from "../charts/theme.js";
import { renderGauge } from "../ui/gauge.js";
import { createRiskChip } from "../ui/risk-chip.js";
import { createWeatherStat } from "../ui/weather-stat.js";
import { createEmptyState } from "../ui/empty-state.js";
import { loadData } from "../core/data-state.js";
import { setSharedData, subscribeToSharedData } from "../core/store.js";
import { riskLevelForScore } from "../utils/risk.js";
import { formatNumber, formatValue } from "../utils/format.js";
import { iconSvg } from "../ui/icons.js";
import { escapeHtml } from "../utils/dom.js";

const styles = ["dashboard.css", "dashboard-responsive.css", "layout-overrides.css"];

function ensureStyles() {
  for (const file of styles) {
    const id = `phase3-${file}`;
    if (document.getElementById(id)) continue;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `assets/css/${file}`;
    document.head.append(link);
  }
}

function firstName(name) { return String(name || "Chief").split(" ")[0]; }
function greeting(hour) { return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"; }

export async function mount(main, user) {
  ensureStyles();
  renderShell(main, user);
  const summaryLoader = loadData((signal) => fetchDashboardSummary({ signal }), [], {
    container: main.querySelector(".dashboard-summary-slot"),
    loading: skeleton,
    emptyTitle: "No dashboard data",
    emptyMessage: "Dashboard metrics are not available yet.",
    emptyIcon: "chart",
    success: (container, summary) => { container.replaceChildren(); renderSummary(main, summary); },
  });
  const cityRiskLoader = loadData((signal) => fetchCityRisk({ signal }), [], {
    container: main.querySelector(".dashboard-city-risk-slot"),
    loading: skeleton,
    success: (container, risk) => {
      container.replaceChildren();
      setSharedData({ riskScores: risk });
      renderGauge(main.querySelector(".gauge-slot"), risk?.riskScore ?? null);
      main.querySelector(".risk-level-slot").replaceChildren(createRiskChip(risk?.riskLevel || riskLevelForScore(risk?.riskScore)));
    },
    emptyTitle: "City risk unavailable",
    emptyMessage: "No city risk score is available.",
  });
  const weatherLoader = loadData((signal) => fetchWeather({ signal }), [], {
    container: main.querySelector(".dashboard-weather-slot"),
    loading: skeleton,
    success: (container, weather) => { container.replaceChildren(); renderWeather(main, weather); },
    emptyTitle: "Weather unavailable",
    emptyMessage: "Current weather data is not available.",
  });
  const mapLoader = loadData(async (signal) => {
    const [areas, incidents, stations] = await Promise.all([
      fetchRiskAreas({ signal }), fetchIncidents({ signal }), fetchStations({ signal }),
    ]);
    return { areas, incidents, stations };
  }, [], {
    container: main.querySelector(".dashboard-map-slot"),
    loading: skeleton,
    emptyTitle: "Map data unavailable",
    emptyMessage: "Risk overview layers are not available.",
    success: (container, data) => {
      container.replaceChildren();
      void renderMap(main.querySelector(".dashboard-mini-map"), data).catch((error) => {
        container.replaceChildren();
        const state = createEmptyState("Risk map unavailable", formatValue(error?.message, "Map layers could not be rendered."), "map");
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "button button-secondary button-sm";
        retry.textContent = "Retry";
        retry.addEventListener("click", () => { void mapLoader.load(); });
        state.append(retry);
        container.append(state);
      });
    },
  });
  subscribeToSharedData("incidentRefreshAt", (timestamp) => {
    if (timestamp) void summaryLoader.load();
  });
  await Promise.all([summaryLoader.load(), cityRiskLoader.load(), weatherLoader.load(), mapLoader.load()]);
}

function skeleton(container) {
  const node = document.createElement("div");
  node.className = "skeleton dashboard-widget-skeleton";
  container.replaceChildren(node);
}

function renderShell(main, user) {
  const dateLabel = new Date().toLocaleDateString("en-PH", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
  main.innerHTML = `<div class="dashboard-content">
    <div class="dashboard-heading"><div><span class="eyebrow">${dateLabel}</span><h1>${greeting(new Date().getHours())}, ${escapeHtml(firstName(user?.name))}</h1><p>Here is Tacloban City’s fire risk outlook and operational picture.</p></div><a class="button button-secondary create-report-button" href="reports.html">${iconSvg("file", 15)}Create report</a></div>
    <div class="dashboard-summary-slot"></div>
    <div class="dashboard-middle-grid">
      <section class="surface-card city-risk-card"><div class="risk-title-row"><div><span class="eyebrow">PREDICTION · NEXT 24 HOURS</span><h2>Overall city risk</h2></div><span class="risk-level-slot"></span></div><div class="dashboard-city-risk-slot"></div><div class="gauge-slot"></div></section>
      <div class="weather-trend-stack"><section class="surface-card dashboard-weather"><div class="weather-card-top"><div><h2>Live weather</h2><span class="live-pill"><i></i><span class="weather-live-label">LOADING</span></span></div></div><div class="dashboard-weather-slot"></div><div class="weather-metrics"></div></section>
        <section class="surface-card monthly-card"><div class="monthly-heading"><div><span class="eyebrow">LAST 12 MONTHS</span><h2>Monthly incidents</h2></div><label class="year-select"><span class="sr-only">Chart year</span><select disabled><option>No data</option></select></label></div><div class="monthly-chart"><canvas aria-label="Monthly incidents" role="img"></canvas></div><div class="monthly-data-slot"></div></section></div>
      <section class="surface-card top-risk-card"><div class="panel-heading"><h2>Highest-risk barangays</h2><a href="risk-map.html">View map ${iconSvg("arrow", 11)}</a></div><div class="top-risk-slot"></div></section>
    </div>
    <div class="dashboard-lower-grid"><section class="surface-card risk-overview-card"><div class="panel-heading"><h2>Risk overview</h2><a href="risk-map.html">${iconSvg("map", 12)}Open map</a></div><div class="mini-map-frame"><div class="dashboard-mini-map"></div><div class="dashboard-map-slot"></div></div></section>
      <section class="surface-card recent-incidents-card"><div class="panel-heading"><h2>Recent incidents</h2><a href="incidents.html">View all ${iconSvg("arrow", 11)}</a></div><div class="recent-incident-list"></div></section></div>
    <span class="dashboard-data-note">Dashboard data is loading.</span>
  </div>`;
}

function renderSummary(main, summary = {}) {
  const data = summary.data || summary;
  const kpis = data.kpis || {};
  const metrics = [
    ["incidents", "Total incidents", kpis.incidentCount, "Current data set", "flame", "accent"],
    ["areas", "High-risk areas", kpis.highRiskAreas, "Need action", "flame", "accent"],
    ["hotspots", "Predicted hotspots", kpis.predictedHotspots, "Ranked by risk score", "map", "info"],
    ["stations", "Active stations", kpis.activeStations, "Operational stations", "shield", "success"],
  ];
  const summarySlot = main.querySelector(".dashboard-summary-slot");
  summarySlot.innerHTML = `<div class="dashboard-kpis">${metrics.map(([, label, value, detail, icon, color]) => `<article class="surface-card stat-card stat-${color}"><div class="stat-copy"><span class="stat-icon">${iconSvg(icon, 16)}</span><div><small>${label}</small><strong>${escapeHtml(formatValue(value))}</strong><span class="stat-detail">${detail}</span></div></div><svg class="stat-spark" viewBox="0 0 112 34" aria-hidden="true"><polyline points="0,14 12.4,18 24.8,16 37.2,21 49.6,18 62,24 74.4,21 86.8,26 99.2,23 111.6,28"></polyline></svg></article>`).join("")}</div>`;
  const areas = data.topBarangays || [];
  const rankingSlot = main.querySelector(".top-risk-slot");
  rankingSlot.replaceChildren();
  if (areas.length) {
    const list = document.createElement("ol");
    list.className = "top-risk-list";
    [...areas].sort((a, b) => Number(b.riskScore) - Number(a.riskScore)).slice(0, 5).forEach((area, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.addEventListener("click", () => { window.location.href = `risk-map.html?area=${encodeURIComponent(area.id)}`; });
      const rank = document.createElement("span"); rank.className = "risk-rank"; rank.textContent = String(index + 1);
      const name = document.createElement("span"); name.className = "risk-name";
      const title = document.createElement("b"); title.textContent = formatValue(area.name);
      const trend = document.createElement("small"); trend.textContent = "Risk outlook";
      name.append(title, trend);
      const score = document.createElement("strong"); score.textContent = formatNumber(area.riskScore);
      button.append(rank, name, createRiskChip(area.riskLevel || riskLevelForScore(area.riskScore)), score);
      item.append(button); list.append(item);
    });
    rankingSlot.append(list);
  } else rankingSlot.append(createEmptyState("No barangays to rank", "Highest-risk areas appear when risk data is available.", "map"));
  const incidents = data.recentIncidents || [];
  const recent = main.querySelector(".recent-incident-list");
  recent.replaceChildren();
  if (incidents.length) {
    incidents.slice(0, 3).forEach((incident, index) => {
      const link = document.createElement("a");
      link.href = `incidents.html?incident=${encodeURIComponent(incident.id)}`;
      link.className = "recent-incident";
      link.innerHTML = `<span class="recent-incident-icon recent-${index}">${iconSvg("flame", 14)}</span>`;
      const copy = document.createElement("span"); copy.className = "recent-incident-copy";
      const barangay = document.createElement("b"); barangay.textContent = formatValue(incident.barangay);
      const category = document.createElement("small"); category.textContent = formatValue(incident.fireClass || incident.class);
      copy.append(barangay, category); link.append(copy); recent.append(link);
    });
  } else recent.append(createEmptyState("No recent incidents", "New incidents will appear here when available.", "activity"));
  const monthly = data.monthlyIncidents || [];
  main.querySelector(".monthly-data-slot").replaceChildren();
  if (!monthly.length) main.querySelector(".monthly-data-slot").append(createEmptyState("No data yet", "Monthly incident data is not available.", "chart"));
  void renderMonthlyChart(main.querySelector(".monthly-chart canvas"), monthly).catch((error) => {
    const slot = main.querySelector(".monthly-data-slot");
    slot.replaceChildren(createEmptyState("Chart unavailable", formatValue(error?.message, "Monthly incident data could not be drawn."), "chart"));
  });
  const high = formatValue(kpis.highRiskAreas, "0");
  const active = formatValue(kpis.activeStations, "0");
  main.querySelector(".dashboard-data-note").textContent = `${high} high-risk barangays · ${active} stations currently operational`;
}

function renderWeather(main, weather) {
  const slot = main.querySelector(".dashboard-weather-slot");
  slot.innerHTML = `<div class="weather-conditions"><span class="weather-sun-icon" aria-hidden="true">${iconSvg("sun", 40)}</span><strong>${escapeHtml(formatValue(weather.temperatureC))}°</strong><span>Feels like ${escapeHtml(formatValue(weather.feelsLikeC))}°</span><div><b>Current conditions</b><small>Tacloban City</small></div></div>`;
  main.querySelector(".weather-live-label").textContent = "LIVE";
  const metricElements = main.querySelector(".weather-metrics");
  metricElements.replaceChildren(
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("droplets", 20)), value: weather.humidityPercent, suffix: "%", label: "Humidity" }),
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("rain", 20)), value: weather.rainfallMm, suffix: "mm", label: "Rainfall" }),
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("wind", 20)), value: weather.windKph, suffix: "km/h", label: "Wind" }),
  );
  setSharedData({ weather });
}

async function renderMonthlyChart(canvas, points) {
  const Chart = await loadChartJs();
  Chart.getChart?.(canvas)?.destroy();
  const summary = points.length
    ? points.map((point) => `${point.month ?? "Month"}: ${Number.isFinite(Number(point.count)) ? Number(point.count) : "unavailable"} incidents`).join("; ")
    : "No monthly incident data is available.";
  describeChart(canvas, "Monthly incidents by month", summary);
  if (!points.length) return;
  const options = {
    ...chartBaseOptions,
    plugins: { ...chartBaseOptions.plugins, legend: { display: false } },
    scales: {
      x: { ...chartBaseOptions.scales.x, ticks: { ...chartBaseOptions.scales.x.ticks, font: { size: 8 } } },
      y: { ...chartBaseOptions.scales.y, beginAtZero: true, ticks: { ...chartBaseOptions.scales.y.ticks, maxTicksLimit: 4 } },
    },
  };
  const year = new Date().getFullYear();
  const current = points.filter((point) => point.year === year);
  if (!current.length) return;
  new Chart(canvas, {
    type: "line",
    data: { labels: current.map((point) => point.month), datasets: [{ data: current.map((point) => point.count), fill: true, tension: 0.34, borderColor: chartColors.brandAccent, borderWidth: 2, pointRadius: 0, backgroundColor: (context) => chartGradient(context, chartColors.brandAccent, 0.2) }] },
    options,
  });
}

let overviewMap;
let overviewLayers;
let overviewContainer;
let overviewDestroy;
async function renderMap(container, data) {
  if (overviewContainer && overviewContainer !== container) {
    overviewLayers?.destroy();
    overviewDestroy?.();
    overviewMap = null;
    overviewLayers = null;
  }
  if (!overviewMap) {
    const created = await createMap(container, { interactive: false, zoom: 12.1 });
    overviewMap = created.map;
    overviewDestroy = created.destroy;
    overviewContainer = container;
  }
  if (!overviewLayers) {
    overviewLayers = await addMapLayers(overviewMap, { ...data, hotspots: [], visibility: { riskZones: true, incidents: false, hotspots: false, fireStations: false } });
  } else overviewLayers.updateData(data);
  overviewMap.invalidateSize({ animate: false, pan: false });
  container.querySelectorAll(".map-side-panel, .leaflet-control-zoom").forEach((node) => node.remove());
}
