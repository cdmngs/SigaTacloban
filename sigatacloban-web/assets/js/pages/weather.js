import { fetchWeatherAnalysis, fetchWeatherRiskDays, fetchWeatherCorrelation } from "../api/weatherAnalysis.js";
import { fetchRiskAreas } from "../api/risk.js";
import { loadChartJs, chartBaseOptions, chartColors, chartGradient, describeChart } from "../charts/theme.js";
import { createWeatherStat } from "../ui/weather-stat.js";
import { iconSvg } from "../ui/icons.js";
import { createRiskChip } from "../ui/risk-chip.js";
import { escapeHtml } from "../utils/dom.js";

const styles = ["phase3-pages.css", "weather.css", "phase3-responsive.css"];
function ensureStyles() {
  for (const file of styles) {
    const id = `phase3-${file}`;
    if (document.getElementById(id)) continue;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet"; link.href = `assets/css/${file}`; document.head.append(link);
  }
}
function showError(main, retry) {
  main.innerHTML = `<div class="phase3-page"><div class="query-error" role="alert"><b>Weather analysis could not be loaded.</b><button type="button" class="button button-primary">Retry</button></div></div>`;
  main.querySelector("button").addEventListener("click", retry);
}
function relativeUpdatedAt(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Not updated yet";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return "Updated just now";
  if (elapsedMinutes < 60) return `Updated ${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Updated ${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Updated ${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`;
}
function titleCaseCondition(value) {
  const text = String(value ?? "").trim();
  if (!text) return "No conditions available";
  if (text.toLowerCase() === "sun") return "Sunny";
  if (text.toLowerCase() === "rain") return "Rainy";
  return text[0].toUpperCase() + text.slice(1);
}

export async function mount(main) {
  ensureStyles();
  main.innerHTML = `<div class="phase3-page phase3-loading"><div class="skeleton phase3-title-skeleton"></div><div class="skeleton weather-hero-skeleton"></div><div class="skeleton weather-forecast-skeleton"></div><div><div class="skeleton"></div><div class="skeleton"></div></div></div>`;
  const load = async () => {
    try {
      const [current, days, correlation, areas] = await Promise.all([
        fetchWeatherAnalysis(), fetchWeatherRiskDays(), fetchWeatherCorrelation(30), fetchRiskAreas(),
      ]);
      render(main, { current, days, correlation, areas });
    } catch { showError(main, load); }
  };
  await load();
}

function render(main, data) {
  const { current, days, correlation, areas } = data;
  const hasCurrent = Number.isFinite(Date.parse(current?.updatedAt));
  const currentValue = (key) => {
    const value = current?.[key];
    return hasCurrent && value !== null && value !== undefined && Number.isFinite(Number(value)) ? value : "--";
  };
  const highRiskAreas = areas.filter((area) => area.score >= 65 && (area.factors.find((factor) => factor.label === "Historical frequency")?.value ?? 0) >= 65).length;
  main.innerHTML = `<div class="phase3-page weather-page">
    <header class="phase3-heading"><div><span class="eyebrow">ENVIRONMENT INTELLIGENCE</span><h1>Weather risk analysis</h1><p>Understand how current and forecast conditions influence fire risk.</p></div><button type="button" class="button button-ghost button-sm weather-refresh">${iconSvg("refresh", 14)}<span>${relativeUpdatedAt(current?.updatedAt)}</span></button></header>
    <section class="surface-card weather-hero"><div class="weather-hero-condition"><span class="weather-hero-sun" aria-hidden="true">${iconSvg("sun", 56)}</span><div><small>TACLOBAN CITY</small><strong>${hasCurrent ? `${currentValue("temperatureC")}°C` : "-- C"}</strong><b>${escapeHtml(hasCurrent ? titleCaseCondition(current?.condition) : "No conditions available")}</b><span>Feels like ${hasCurrent ? `${currentValue("feelsLikeC")}°` : "-- C"}</span></div></div><div class="weather-hero-stats"></div></section>
    <section class="surface-card weather-forecast-card"><div class="forecast-title"><span class="eyebrow">WEATHER &amp; PREDICTED RISK</span><h2>7-day forecast</h2></div><div class="forecast-days">${days.length ? days.map((day, index) => `<button type="button" class="forecast-day${index === 0 ? " selected" : ""}" data-day="${index}" aria-pressed="${index === 0}"><b>${escapeHtml(day.label)}</b><span aria-hidden="true">${iconSvg(day.condition === "sun" ? "sun" : "rain", 20)}</span><strong>${day.highC}°</strong><small>Risk ${day.riskScore}</small></button>`).join("") : Array.from({ length: 7 }, (_, index) => `<div class="forecast-day forecast-empty"><b>${index === 0 ? "Today" : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</b><span>—</span><strong>—</strong><small>Risk —</small></div>`).join("")}</div><div class="forecast-selected-risk" aria-live="polite"><span>${escapeHtml(days[0]?.label ?? "Today")} forecast risk</span><span class="forecast-risk-chip"></span></div></section>
    <div class="weather-analysis-grid"><section class="surface-card chart-card weather-chart-card"><header class="chart-card-heading"><div><span class="eyebrow">30-DAY CORRELATION</span><h2>Weather vs fire risk</h2></div><div class="segmented-control" role="group" aria-label="Correlation range"><button type="button" data-period="7">7 days</button><button type="button" data-period="30" class="active">30 days</button></div></header><div class="weather-chart-wrap"><canvas aria-label="Weather versus fire risk over 30 days" role="img"></canvas>${correlation.length ? "" : '<div class="chart-empty-note">No data yet</div>'}</div></section>
      <section class="surface-card risk-conditions-card"><span class="conditions-icon" aria-hidden="true">${iconSvg("barChart", 18)}</span><span class="eyebrow">RISK PATTERN</span><h2>Conditions that elevate risk</h2><div class="condition-chips"><span>High temp</span><i>+</i><span>Low humidity</span><i>+</i><span>Low rain</span><i>+</i><span>Strong wind</span></div><p>These conditions are currently aligned in <b>${highRiskAreas} high-risk barangays.</b></p><a href="risk-map.html" class="button button-secondary">View affected areas</a></section></div>
    <p class="weather-attribution">Weather data: Open-Meteo (mock data for now).</p>
  </div>`;
  const stats = main.querySelector(".weather-hero-stats");
  stats.append(
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("droplets", 24)), value: currentValue("humidityPercent"), suffix: "%", label: "Humidity" }),
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("rain", 24)), value: currentValue("rainfallMm"), suffix: "mm", label: "Rainfall" }),
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("wind", 24)), value: currentValue("windKph"), suffix: "km/h", label: "Wind" }),
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("gauge", 24)), value: currentValue("pressureHpa"), suffix: "hPa", label: "Pressure" }),
  );
  updateForecastChip(main.querySelector(".forecast-risk-chip"), days[0]?.riskScore);
  main.querySelectorAll(".forecast-day[data-day]").forEach((button) => button.addEventListener("click", () => {
    main.querySelectorAll(".forecast-day[data-day]").forEach((item) => { item.classList.toggle("selected", item === button); item.setAttribute("aria-pressed", String(item === button)); });
    const day = days[Number(button.dataset.day)];
    main.querySelector(".forecast-selected-risk > span").textContent = `${day.label} forecast risk`;
    updateForecastChip(main.querySelector(".forecast-risk-chip"), day.riskScore);
  }));
  let chart;
  const draw = async (points, period) => {
    const Chart = await loadChartJs();
    chart?.destroy();
    const canvas = main.querySelector(".weather-chart-wrap canvas");
    const summary = points.length
      ? points.map((point) => `${point.day ?? "Day"}: risk ${Number.isFinite(Number(point.riskScore)) ? Number(point.riskScore) : "unavailable"}, temperature ${Number.isFinite(Number(point.temperatureC)) ? Number(point.temperatureC) : "unavailable"} degrees`).join("; ")
      : "No weather correlation data is available.";
    describeChart(canvas, `Weather versus fire risk over ${period} days`, summary);
    chart = new Chart(canvas, {
      type: "line",
      data: { labels: points.map((point) => point.day), datasets: [
        { label: "Risk score", data: points.map((point) => point.riskScore), borderColor: chartColors.brandAccent, backgroundColor: (context) => chartGradient(context, chartColors.brandAccent, 0.19), fill: true, tension: 0.34, borderWidth: 2.5, pointRadius: 0, yAxisID: "risk" },
        { label: "Temperature", data: points.map((point) => point.temperatureC), borderColor: chartColors.info, backgroundColor: (context) => chartGradient(context, chartColors.info, 0.08), fill: true, tension: 0.34, borderWidth: 2.5, pointRadius: 0, yAxisID: "temperature" },
      ] },
      options: { ...chartBaseOptions, plugins: { ...chartBaseOptions.plugins, legend: { ...chartBaseOptions.plugins.legend, position: "top", align: "start" } }, scales: {
        x: chartBaseOptions.scales.x,
        risk: { type: "linear", position: "left", min: 0, max: 100, grid: { color: chartColors.grid }, border: { display: false }, ticks: { color: chartColors.muted, font: chartBaseOptions.scales.x.ticks.font, maxTicksLimit: 5 } },
        temperature: { type: "linear", position: "right", min: 20, max: 40, grid: { drawOnChartArea: false }, border: { display: false }, ticks: { color: chartColors.muted, font: chartBaseOptions.scales.x.ticks.font, maxTicksLimit: 5, callback: (value) => `${value}°` } },
      } },
    });
  };
  void draw(correlation, 30);
  main.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", async () => {
    const period = Number(button.dataset.period);
    main.querySelectorAll("[data-period]").forEach((item) => item.classList.toggle("active", item === button));
    try { await draw(await fetchWeatherCorrelation(period), period); }
    catch { main.dispatchEvent(new CustomEvent("app:toast", { bubbles: true, detail: { message: "Weather correlation could not be loaded.", type: "error" } })); }
  }));
  main.querySelector(".weather-refresh").addEventListener("click", () => {
    main.querySelector(".weather-refresh span:last-child").textContent = "Refreshing…";
    void Promise.all([fetchWeatherAnalysis(), fetchWeatherRiskDays(), fetchWeatherCorrelation(30), fetchRiskAreas()])
      .then(([next, nextDays, nextCorrelation, nextAreas]) => render(main, { current: next, days: nextDays, correlation: nextCorrelation, areas: nextAreas }))
      .catch(() => showError(main, () => mount(main)));
  });
}

function updateForecastChip(container, score) {
  const value = Number.isFinite(score) ? score : null;
  const level = value === null ? "low" : value >= 80 ? "veryhigh" : value >= 60 ? "high" : value >= 40 ? "moderate" : "low";
  const chip = createRiskChip(level);
  chip.querySelector("span:last-child").textContent = `${value ?? "—"} · ${value === null ? "No data" : level === "veryhigh" ? "Very high" : level[0].toUpperCase() + level.slice(1)}`;
  container.replaceChildren(chip);
}
