import { fetchWeatherAnalysis, fetchWeatherRiskDays, fetchWeatherCorrelation } from "../api/weatherAnalysis.js";
import { fetchWeatherForecast } from "../api/weather.js";
import { fetchRiskAreas } from "../api/risk.js";
import { loadChartJs, chartBaseOptions, chartColors, chartGradient, describeChart } from "../charts/theme.js";
import { createWeatherStat } from "../ui/weather-stat.js";
import { iconSvg } from "../ui/icons.js";
import { createRiskChip } from "../ui/risk-chip.js";
import { createEmptyState } from "../ui/empty-state.js";
import { loadData } from "../core/data-state.js";
import { appStore, setSharedData, subscribeToSharedData } from "../core/store.js";
import { escapeHtml } from "../utils/dom.js";
import { formatNumber, formatValue, formatDateTime } from "../utils/format.js";

const styles = ["phase3-pages.css", "weather.css", "phase3-responsive.css"];
function ensureStyles() {
  for (const file of styles) {
    const id = `phase3-${file}`;
    if (document.getElementById(id)) continue;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet"; link.href = `assets/css/${file}`; document.head.append(link);
  }
}
function relativeUpdatedAt(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Not updated yet";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return "Updated just now";
  if (elapsedMinutes < 60) return `Updated ${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `Updated ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days} ${days === 1 ? "day" : "days"} ago`;
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
  const load = loadData(async (signal) => {
    const results = await Promise.allSettled([
      fetchWeatherAnalysis({ signal }),
      fetchWeatherRiskDays({ signal }),
      fetchWeatherForecast({ signal }),
      fetchWeatherCorrelation(30, { signal }),
      fetchRiskAreas({ signal }),
    ]);
    return results.map((result) => result.status === "fulfilled" ? result.value : { error: result.reason });
  }, [], {
    container: main,
    isEmpty: () => false,
    error(container, error, retry) {
      container.innerHTML = `<div class="phase3-page"><div class="query-error" role="alert"><b>Weather analysis could not be loaded.</b><small>${escapeHtml(error.message || "Check the connection and retry.")}</small><button type="button" class="button button-primary">Retry</button></div></div>`;
      container.querySelector("button").addEventListener("click", () => { void retry(); });
    },
    success(_container, [currentResult, riskResult, forecastResult, correlationResult, areaResult]) {
      const currentError = currentResult?.error || (currentResult?.serviceUnavailable ? new Error("The weather service is unavailable.") : null);
      const stored = appStore.getState().weather;
      const saved = currentResult?.lastSaved || currentResult?.lastAvailable || currentResult?.current || stored;
      const displayCurrent = currentResult?.error ? stored : currentResult?.serviceUnavailable ? saved : currentResult;
      const areas = areaResult.error ? [] : areaResult;
      const forecastDays = riskResult.error ? [] : riskResult;
      const weatherDays = forecastResult.error ? [] : forecastResult;
      const days = mergeForecast(weatherDays, forecastDays);
      render(main, {
        current: displayCurrent,
        currentError,
        days,
        correlation: correlationResult.error ? [] : correlationResult,
        correlationError: correlationResult.error,
        areas,
      });
    },
  });
  await load.load();
}

function mergeForecast(weather, risks) {
  const rows = Array.isArray(weather) ? weather : [];
  const riskRows = Array.isArray(risks) ? risks : [];
  const count = Math.min(7, Math.max(rows.length, riskRows.length));
  return Array.from({ length: count }, (_, index) => {
    const forecast = rows[index] || {};
    const risk = riskRows.find((item) => item.date === forecast.date) || riskRows[index] || {};
    const date = forecast.date || risk.date;
    return {
      ...forecast,
      date,
      label: forecast.label || risk.label || (index === 0 ? "Today" : date ? new Date(`${date}T12:00:00`).toLocaleDateString("en-PH", { weekday: "short" }) : `Day ${index + 1}`),
      highC: forecast.highC ?? forecast.temperatureMaxC ?? forecast.temperatureC ?? risk.highC,
      condition: forecast.condition || risk.condition || "sun",
      riskScore: risk.riskScore ?? forecast.riskScore ?? null,
    };
  });
}

function render(main, data) {
  const { current, currentError, days, correlation, correlationError, areas } = data;
  const hasCurrent = Number.isFinite(Date.parse(current?.updatedAt || current?.asOf));
  const areaOptions = areas.map((area) => `<option value="${escapeHtml(area.id)}">${escapeHtml(area.name)}</option>`).join("");
  const initialArea = appStore.getState().selectedBarangay || "";
  const selectedArea = areas.find((area) => area.id === initialArea);
  const highRiskAreas = areas.filter((area) => Number(area.riskScore ?? area.score) >= 65).length;
  const staleMessage = currentError
    ? `<div class="weather-service-message" role="status">Weather service is unavailable${current ? `; showing last saved data from ${escapeHtml(formatDateTime(current.updatedAt || current.asOf))}` : ". No saved weather data is available."}</div>`
    : "";
  main.innerHTML = `<div class="phase3-page weather-page">
    <header class="phase3-heading"><div><span class="eyebrow">ENVIRONMENT INTELLIGENCE</span><h1>Weather risk analysis</h1><p>Understand how current and forecast conditions influence fire risk.</p></div><button type="button" class="button button-ghost button-sm weather-refresh">${iconSvg("refresh", 14)}<span>${relativeUpdatedAt(current?.updatedAt || current?.asOf)}</span></button></header>
    ${staleMessage}
    <section class="surface-card weather-hero"><div class="weather-hero-condition"><span class="weather-hero-sun" aria-hidden="true">${iconSvg("sun", 56)}</span><div><small>TACLOBAN CITY</small><strong>${current ? `${formatNumber(current.temperatureC)} °C` : "— °C"}</strong><b>${escapeHtml(titleCaseCondition(current?.condition))}</b><span>Feels like ${current ? `${formatNumber(current.feelsLikeC)} °C` : "— °C"}</span></div></div><div class="weather-hero-stats"></div></section>
    <section class="surface-card weather-forecast-card"><div class="forecast-title"><span class="eyebrow">WEATHER &amp; PREDICTED RISK</span><h2>7-day forecast</h2></div><div class="forecast-days">${days.length ? days.slice(0, 7).map((day, index) => `<button type="button" class="forecast-day${index === 0 ? " selected" : ""}" data-day="${index}" aria-pressed="${index === 0}"><b>${escapeHtml(day.label)}</b><span aria-hidden="true">${iconSvg(day.condition === "sun" ? "sun" : "rain", 20)}</span><strong>${day.highC == null ? "—" : `${escapeHtml(formatNumber(day.highC))}°`}</strong><small>Risk ${day.riskScore == null ? "—" : escapeHtml(formatNumber(day.riskScore))}</small></button>`).join("") : '<div class="forecast-empty-message">Forecast data is unavailable.</div>'}</div><div class="forecast-selected-risk" aria-live="polite"><span>${escapeHtml(days[0]?.label ?? "Today")} forecast risk</span><span class="forecast-risk-chip"></span></div></section>
    <div class="weather-analysis-grid"><section class="surface-card chart-card weather-chart-card"><header class="chart-card-heading"><div><span class="eyebrow">30-DAY CORRELATION</span><h2>Weather vs fire risk</h2></div><div class="segmented-control weather-chart-filters" role="group" aria-label="Correlation filters"><select class="weather-area-filter" aria-label="Correlation area"><option value="">All areas</option>${areaOptions}</select><button type="button" data-period="7">7 days</button><button type="button" data-period="30" class="active">30 days</button></div></header><div class="weather-chart-wrap"><canvas aria-label="Weather versus fire risk over 30 days" role="img"></canvas><div class="chart-empty-note" hidden>No data yet</div><div class="weather-chart-error" role="alert" hidden></div></div></section>
      <section class="surface-card risk-conditions-card"><span class="conditions-icon" aria-hidden="true">${iconSvg("barChart", 18)}</span><span class="eyebrow">RISK PATTERN</span><h2>Conditions that elevate risk</h2><div class="condition-chips"><span>High temp</span><i>+</i><span>Low humidity</span><i>+</i><span>Low rain</span><i>+</i><span>Strong wind</span></div><p>These conditions are currently aligned in <b>${highRiskAreas} high-risk barangays.</b></p><a href="risk-map.html" class="button button-secondary">View affected areas</a></section></div>
    <p class="weather-attribution">Weather data: Open-Meteo. Last updated ${escapeHtml(current?.updatedAt ? formatDateTime(current.updatedAt) : "—")}.</p>
  </div>`;
  const stats = main.querySelector(".weather-hero-stats");
  stats.append(
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("droplets", 24)), value: current?.humidityPercent, suffix: "%", label: "Humidity" }),
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("rain", 24)), value: current?.rainfallMm, suffix: "mm", label: "Rainfall" }),
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("wind", 24)), value: current?.windKph, suffix: "km/h", label: "Wind" }),
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("wind", 24)), value: current?.windDirection, label: "Wind direction" }),
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("wind", 24)), value: current?.gustKph, suffix: "km/h", label: "Gusts" }),
    createWeatherStat({ icon: document.createRange().createContextualFragment(iconSvg("gauge", 24)), value: current?.pressureHpa, suffix: "hPa", label: "Pressure" }),
  );
  if (current) setSharedData({ weather: current });
  const initialRisk = days[0]?.riskScore;
  if (initialRisk == null) main.querySelector(".forecast-risk-chip").replaceChildren(createEmptyState("Risk unavailable", "No forecast risk score is available.", "info"));
  else updateForecastChip(main.querySelector(".forecast-risk-chip"), Number(initialRisk));
  main.querySelectorAll(".forecast-day[data-day]").forEach((button) => button.addEventListener("click", () => {
    main.querySelectorAll(".forecast-day[data-day]").forEach((item) => { item.classList.toggle("selected", item === button); item.setAttribute("aria-pressed", String(item === button)); });
    const day = days[Number(button.dataset.day)];
    main.querySelector(".forecast-selected-risk > span").textContent = `${day.label} forecast risk`;
    if (day.riskScore == null) main.querySelector(".forecast-risk-chip").replaceChildren(createEmptyState("Risk unavailable", "No forecast risk score is available.", "info"));
    else updateForecastChip(main.querySelector(".forecast-risk-chip"), Number(day.riskScore));
  }));
  let chart;
  const draw = async (points, period) => {
    const Chart = await loadChartJs();
    chart?.destroy();
    const canvas = main.querySelector(".weather-chart-wrap canvas");
    const valid = Array.isArray(points) ? points : [];
    const summary = valid.length
      ? valid.map((point) => `${point.day ?? "Day"}: risk ${Number.isFinite(Number(point.riskScore)) ? Number(point.riskScore) : "unavailable"}, temperature ${Number.isFinite(Number(point.temperatureC)) ? Number(point.temperatureC) : "unavailable"} degrees`).join("; ")
      : "No weather correlation data is available.";
    describeChart(canvas, `Weather versus fire risk over ${period} days`, summary);
    const empty = main.querySelector(".chart-empty-note");
    empty.hidden = valid.length > 0;
    if (!valid.length) return;
    chart = new Chart(canvas, {
      type: "line",
      data: { labels: valid.map((point) => point.day), datasets: [
        { label: "Risk score", data: valid.map((point) => point.riskScore), borderColor: chartColors.brandAccent, backgroundColor: (context) => chartGradient(context, chartColors.brandAccent, 0.19), fill: true, tension: 0.34, borderWidth: 2.5, pointRadius: 0, yAxisID: "risk" },
        { label: "Temperature", data: valid.map((point) => point.temperatureC), borderColor: chartColors.info, backgroundColor: (context) => chartGradient(context, chartColors.info, 0.08), fill: true, tension: 0.34, borderWidth: 2.5, pointRadius: 0, yAxisID: "temperature" },
      ] },
      options: { ...chartBaseOptions, plugins: { ...chartBaseOptions.plugins, legend: { ...chartBaseOptions.plugins.legend, position: "top", align: "start" } }, scales: {
        x: chartBaseOptions.scales.x,
        risk: { type: "linear", position: "left", min: 0, max: 100, grid: { color: chartColors.grid }, border: { display: false }, ticks: { color: chartColors.muted, font: chartBaseOptions.scales.x.ticks.font, maxTicksLimit: 5 } },
        temperature: { type: "linear", position: "right", min: 20, max: 40, grid: { drawOnChartArea: false }, border: { display: false }, ticks: { color: chartColors.muted, font: chartBaseOptions.scales.x.ticks.font, maxTicksLimit: 5, callback: (value) => `${value}°` } },
      } },
    });
  };
  let period = 30;
  let chartController = null;
  const reloadChart = async () => {
    chartController?.abort();
    chartController = new AbortController();
    const signal = chartController.signal;
    const filter = main.querySelector(".weather-area-filter").value;
    const chartState = main.querySelector(".weather-chart-error");
    chartState.hidden = true;
    try {
      const points = await fetchWeatherCorrelation(period, { areaId: filter, signal });
      if (!signal.aborted) await draw(points, period);
    } catch (error) {
      if (signal.aborted) return;
      chartState.textContent = `Weather correlation could not be loaded: ${error.message}`;
      chartState.hidden = false;
    }
  };
  if (!correlationError) void draw(correlation, 30).catch((error) => {
    const state = main.querySelector(".weather-chart-error");
    state.textContent = `Weather correlation could not be drawn: ${error.message}`;
    state.hidden = false;
  });
  else {
    const state = main.querySelector(".weather-chart-error");
    state.textContent = `Weather correlation could not be loaded: ${correlationError.message}`;
    state.hidden = false;
  }
  main.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", () => {
    period = Number(button.dataset.period);
    main.querySelectorAll("[data-period]").forEach((item) => item.classList.toggle("active", item === button));
    main.querySelector(".weather-chart-card .eyebrow").textContent = `${period}-DAY CORRELATION`;
    void reloadChart();
  }));
  main.querySelector(".weather-area-filter").addEventListener("change", () => { void reloadChart(); });
  const refresh = async () => {
    main.querySelector(".weather-refresh span:last-child").textContent = "Refreshing…";
    try {
      const [next, nextRisk, nextForecast, nextCorrelation, nextAreas] = await Promise.all([
        fetchWeatherAnalysis(), fetchWeatherRiskDays(), fetchWeatherForecast(), fetchWeatherCorrelation(period, { areaId: selectedArea?.id }), fetchRiskAreas(),
      ]);
      render(main, { current: next, currentError: null, days: mergeForecast(nextForecast, nextRisk), correlation: nextCorrelation, areas: nextAreas });
    } catch (error) {
      main.querySelector(".weather-refresh span:last-child").textContent = relativeUpdatedAt(current?.updatedAt);
      let note = main.querySelector(".weather-service-message");
      if (!note) {
        note = document.createElement("div");
        note.className = "weather-service-message";
        note.setAttribute("role", "alert");
        main.querySelector(".weather-page").insertBefore(note, main.querySelector(".weather-hero"));
      }
      note.textContent = `Weather service is unavailable. ${error.message || "Try refreshing again."}`;
    }
  };
  main.querySelector(".weather-refresh").addEventListener("click", () => { void refresh(); });
  const unsubscribe = subscribeToSharedData("selectedBarangay", (id) => {
    const select = main.querySelector(".weather-area-filter");
    if (!select) return;
    select.value = areas.some((area) => area.id === id) ? id : "";
    void reloadChart();
  });
  main.addEventListener("app:pagehide", unsubscribe, { once: true });
}

function updateForecastChip(container, score) {
  const value = Number.isFinite(score) ? score : null;
  const level = value === null ? "low" : value >= 80 ? "veryhigh" : value >= 60 ? "high" : value >= 40 ? "moderate" : "low";
  const chip = createRiskChip(level);
  chip.querySelector("span:last-child").textContent = `${value ?? "—"} · ${value === null ? "No data" : level === "veryhigh" ? "Very high" : level[0].toUpperCase() + level.slice(1)}`;
  container.replaceChildren(chip);
}
