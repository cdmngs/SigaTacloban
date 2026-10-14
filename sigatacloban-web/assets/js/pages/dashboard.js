import { fetchRiskAreas, fetchMonthlyIncidents } from "../api/risk.js";
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

function renderError(main, retry) {
  main.innerHTML = `<div class="dashboard-content"><div class="query-error" role="alert"><b>Dashboard data could not be loaded. Check the connection and retry.</b><button type="button" class="button button-primary">Retry</button></div></div>`;
  main.querySelector("button").addEventListener("click", retry);
}

export async function mount(main, user) {
  ensureStyles();
  main.innerHTML = `<div class="dashboard-skeleton"><div class="skeleton skeleton-title"></div><div class="skeleton-kpis">${Array.from({ length: 4 }, () => '<div class="skeleton"></div>').join("")}</div><div class="skeleton-row">${Array.from({ length: 3 }, () => '<div class="skeleton"></div>').join("")}</div><div class="skeleton skeleton-map"></div></div>`;
  let requests;
  const load = async () => {
    try {
      requests = await Promise.all([fetchRiskAreas(), fetchIncidents(), fetchStations(), fetchWeather(), fetchMonthlyIncidents()]);
      render(main, user, requests);
    } catch {
      renderError(main, load);
    }
  };
  await load();
}

function render(main, user, [areas, incidents, stations, weather, monthly]) {
  const ranked = [...areas].sort((a, b) => b.score - a.score);
  const highRiskCount = areas.filter((area) => area.score >= 65).length;
  const activeStations = stations.filter((station) => station.operational).length;
  const dateLabel = new Date().toLocaleDateString("en-PH", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
  const metrics = [
    ["incidents", "Total incidents", incidents.length, incidents.length ? "Current data set" : "No incidents available", "flame", "accent"],
    ["areas", "High-risk areas", highRiskCount, highRiskCount ? `${highRiskCount} need action` : "No high-risk areas", "flame", "accent"],
    ["hotspots", "Predicted hotspots", ranked.length, ranked.length ? "Ranked by risk score" : "No forecast data", "map", "info"],
    ["stations", "Active stations", activeStations, activeStations ? "Operational stations" : "No stations available", "shield", "success"],
  ];
  main.innerHTML = `<div class="dashboard-content">
    <div class="dashboard-heading"><div><span class="eyebrow">${dateLabel}</span><h1>${greeting(new Date().getHours())}, ${escapeHtml(firstName(user?.name))}</h1><p>Here is Tacloban City’s fire risk outlook and operational picture.</p></div><a class="button button-secondary create-report-button" href="reports.html">${iconSvg("file", 15)}Create report</a></div>
    <div class="dashboard-kpis">${metrics.map(([, label, value, detail, icon, color]) => `<article class="surface-card stat-card stat-${color}"><div class="stat-copy"><span class="stat-icon">${iconSvg(icon, 16)}</span><div><small>${label}</small><strong>${value}</strong><span class="stat-detail">${detail}</span></div></div><svg class="stat-spark" viewBox="0 0 112 34" aria-hidden="true"><polyline points="0,14 12.4,18 24.8,16 37.2,21 49.6,18 62,24 74.4,21 86.8,26 99.2,23 111.6,28"></polyline></svg></article>`).join("")}</div>
    <div class="dashboard-middle-grid">
      <section class="surface-card city-risk-card"><div class="risk-title-row"><div><span class="eyebrow">PREDICTION · NEXT 24 HOURS</span><h2>Overall city risk</h2></div><span class="risk-level-slot"></span></div><div class="gauge-slot"></div></section>
      <div class="weather-trend-stack"><section class="surface-card dashboard-weather"><div class="weather-card-top"><div><h2>Live weather</h2><span class="live-pill"><i></i>${weather ? "LIVE" : "UNAVAILABLE"}</span></div></div><div class="weather-conditions"><span class="weather-sun-icon" aria-hidden="true">${iconSvg("sun", 40)}</span><strong>${weather ? weather.temperatureC : "—"}°</strong><span>Feels like ${weather ? weather.feelsLikeC : "—"}°</span><div><b>${weather ? "Current conditions" : "Weather unavailable"}</b><small>Tacloban City</small></div></div><div class="weather-metrics"></div></section>
        <section class="surface-card monthly-card"><div class="monthly-heading"><div><span class="eyebrow">LAST 12 MONTHS</span><h2>Monthly incidents</h2></div><label class="year-select"><span class="sr-only">Chart year</span><select disabled><option>No data</option></select></label></div><div class="monthly-chart"><canvas aria-label="Monthly incidents" role="img"></canvas></div>${monthly.length ? "" : '<div class="dashboard-monthly-empty"></div>'}</section></div>
      <section class="surface-card top-risk-card"><div class="panel-heading"><h2>Highest-risk barangays</h2><a href="risk-map.html">View map ${iconSvg("arrow", 11)}</a></div>${ranked.length ? `<ol class="top-risk-list">${ranked.slice(0, 5).map((area, index) => `<li><button type="button"><span class="risk-rank">${index + 1}</span><span class="risk-name"><b>${escapeHtml(area.name)}</b><small>Risk ${escapeHtml(area.trend)}</small></span><span class="risk-chip risk-${escapeHtml(area.level)}"><i></i><span>${escapeHtml(area.level)}</span></span><strong>${area.score}</strong></button></li>`).join("")}</ol>` : '<div class="dashboard-top-risk-empty"></div>'}</section>
    </div>
    <div class="dashboard-lower-grid"><section class="surface-card risk-overview-card"><div class="panel-heading"><h2>Risk overview</h2><a href="risk-map.html">${iconSvg("map", 12)}Open map</a></div><div class="mini-map-frame"><div class="dashboard-mini-map"></div></div></section>
      <section class="surface-card recent-incidents-card"><div class="panel-heading"><h2>Recent incidents</h2><a href="incidents.html">View all ${iconSvg("arrow", 11)}</a></div><div class="recent-incident-list">${incidents.length ? incidents.slice(0, 3).map((incident, index) => `<a href="incidents.html?incident=${encodeURIComponent(incident.id)}" class="recent-incident"><span class="recent-incident-icon recent-${index}">${iconSvg("flame", 14)}</span><span class="recent-incident-copy"><b>${escapeHtml(incident.barangay)}</b><small>${escapeHtml(incident.class)}</small></span></a>`).join("") : '<div class="dashboard-recent-empty"></div>'}</div></section></div>
    <span class="dashboard-data-note">${highRiskCount} high-risk barangays · ${activeStations} stations currently operational</span>
  </div>`;
  main.querySelector(".dashboard-monthly-empty")?.replaceChildren(createEmptyState("No data yet", "Monthly incident data is not available.", "chart"));
  main.querySelector(".dashboard-top-risk-empty")?.replaceWith(createEmptyState("No barangays to rank", "Highest-risk areas appear when risk data is available.", "map"));
  main.querySelector(".dashboard-recent-empty")?.replaceWith(createEmptyState("No recent incidents", "New incidents will appear here when available.", "activity"));
  if (ranked[0] && ranked[0].score >= 40) {
    const riskWarning = document.createElement("div");
    riskWarning.className = "risk-warning";
    const copy = document.createElement("span");
    const title = document.createElement("b");
    const detail = document.createElement("small");
    title.textContent = "Elevated conditions detected in Tacloban City.";
    detail.textContent = `Current outlook: ${ranked[0].score}/100.`;
    copy.append(title, detail);
    riskWarning.append(document.createRange().createContextualFragment(iconSvg("flame", 15)), copy);
    main.querySelector(".city-risk-card").append(riskWarning);
  }
  const chipSlot = main.querySelector(".risk-level-slot");
  const chip = createRiskChip(ranked[0]?.level ?? "low");
  if (!ranked[0]) chip.querySelector("span:last-child").textContent = "No data";
  chipSlot.append(chip);
  renderGauge(main.querySelector(".gauge-slot"), ranked[0]?.score ?? null);
  const metricElements = main.querySelector(".weather-metrics");
  metricElements.append(
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("droplets", 20)), value: weather?.humidityPercent ?? null, suffix: "%", label: "Humidity" }),
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("rain", 20)), value: weather?.rainfallMm ?? null, suffix: "mm", label: "Rainfall" }),
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("wind", 20)), value: weather?.windKph ?? null, suffix: "km/h", label: "Wind" }),
  );
  void renderMonthlyChart(main.querySelector(".monthly-chart canvas"), monthly);
  void renderMap(main.querySelector(".dashboard-mini-map"), areas, incidents, stations);
}

async function renderMonthlyChart(canvas, points) {
  const Chart = await loadChartJs();
  const summary = points.length
    ? points.map((point) => `${point.month ?? "Month"}: ${Number.isFinite(Number(point.count)) ? Number(point.count) : "unavailable"} incidents`).join("; ")
    : "No monthly incident data is available.";
  describeChart(canvas, "Monthly incidents by month", summary);
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
  new Chart(canvas, {
    type: "line",
    data: { labels: current.map((point) => point.month), datasets: [{ data: current.map((point) => point.count), fill: true, tension: 0.34, borderColor: chartColors.brandAccent, borderWidth: 2, pointRadius: 0, backgroundColor: (context) => chartGradient(context, chartColors.brandAccent, 0.2) }] },
    options,
  });
}

async function renderMap(container, areas, incidents, stations) {
  const { map } = await createMap(container, { interactive: false, zoom: 12.1 });
  await addMapLayers(map, { areas, incidents, hotspots: [], stations, visibility: { riskZones: true, incidents: true, hotspots: true, fireStations: true } });
}
