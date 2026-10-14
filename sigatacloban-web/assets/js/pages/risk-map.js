import { fetchRiskForDay } from "../api/risk.js";
import { fetchIncidents } from "../api/incidents.js";
import { fetchStations } from "../api/stations.js";
import { fetchWeather } from "../api/weather.js";
import { nominatimSearch } from "../api/nominatim.js";
import { MAP_CENTER } from "../api/config.js";
import { createMap } from "../maps/map-view.js";
import { addMapLayers } from "../maps/layers.js";
import { createMapModeControl } from "../ui/map-mode-control.js";
import { createRiskChip } from "../ui/risk-chip.js";
import { renderRiskDna } from "../ui/risk-dna-bars.js";
import { createEmptyState } from "../ui/empty-state.js";
import { escapeHtml } from "../utils/dom.js";
import { iconSvg } from "../ui/icons.js";

const styles = ["risk-map.css", "risk-map-responsive.css", "layout-overrides.css"];
const layerOptions = [["riskZones", "Risk zones", "#F77F00"], ["incidents", "Incidents", "#941B0C"], ["hotspots", "Hotspots", "#BC3908"], ["fireStations", "Fire stations", "#220901"]];
const riskLevels = [["Low", "#2E9E5B"], ["Moderate", "#F4C430"], ["High", "#F77F00"], ["Very high", "#D62828"]];
const days = ["Today", "+1", "+2", "+3", "+4", "+5", "+6", "+7"];
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
  document.body.classList.add("risk-map-active");
  const params = new URLSearchParams(window.location.search);
  let day = Math.max(0, Math.min(7, Number(params.get("day")) || 0));
  let selectedAreaId = params.get("area");
  let layers = { riskZones: true, incidents: true, hotspots: true, fireStations: true };
  let mode = "risk";
  let showNoData = sessionStorage.getItem("risk-map-no-data-dismissed") !== "true";
  let currentMap;
  let layerSet;
  let activeAreas = [];
  let activeIncidents = [];
  let activeStations = [];
  let activeWeather = null;
  let debounce;
  let searchController;
  const buildLayers = () => addMapLayers(currentMap, {
    areas: activeAreas,
    incidents: activeIncidents,
    stations: activeStations,
    hotspots: activeAreas.map((area) => ({ lat: area.center?.[0], lng: area.center?.[1], score: area.score })),
    selectedAreaId,
    visibility: layers,
    onSelectArea: (id) => {
      selectedAreaId = id;
      const area = activeAreas.find((item) => item.id === id);
      if (area) {
        const params = new URLSearchParams(window.location.search);
        params.set("area", id);
        window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
        showAreaDetails(main.querySelector(".risk-map-screen"), area, activeWeather);
      }
    },
  });
  const load = async () => {
    try {
      const [areas, incidents, stations, weather] = await Promise.all([fetchRiskForDay(day), fetchIncidents(), fetchStations(), fetchWeather()]);
      activeAreas = areas; activeIncidents = incidents; activeStations = stations;
      activeWeather = weather;
      render(main, { areas, incidents, stations, weather });
      const mapHost = main.querySelector(".risk-map-view");
      const created = await createMap(mapHost, { interactive: true, zoom: 12.1 });
      currentMap = created.map;
      const zoom = created.L.control.zoom({ position: "bottomright" });
      zoom.addTo(currentMap);
      layerSet = await buildLayers();
      main.querySelector(".map-loading-veil")?.remove();
      if (areas.length === 0) main.querySelector(".map-empty-banner").hidden = !showNoData;
      const selected = areas.find((area) => area.id === selectedAreaId);
      if (selected) showAreaDetails(main.querySelector(".risk-map-screen"), selected, weather);
      return { weather };
    } catch (error) {
      main.innerHTML = `<div class="risk-map-error"><div class="query-error" role="alert"><b>Map data could not be loaded. Retry to restore the risk layers.</b><small>${escapeHtml(error instanceof Error ? error.message : "An unexpected map error occurred.")}</small><button type="button" class="button button-primary">Retry</button></div></div>`;
      main.querySelector("button").addEventListener("click", () => { void load(); });
      throw error;
    }
  };
  try { await load(); }
  catch { /* Error state is rendered above; the page remains recoverable through Retry. */ }

  function render(main, { areas, incidents, stations, weather }) {
    const layout = document.createElement("section");
    layout.className = "risk-map-screen";
    layout.setAttribute("aria-label", "Tacloban fire risk map");
    layout.innerHTML = `<div class="risk-map-layout">
      <aside class="map-side-panel risk-map-side-panel" aria-label="Map controls"><button type="button" class="map-side-panel-toggle" aria-controls="risk-map-controls" aria-expanded="true"><span>Map controls</span><span class="map-side-panel-chevron">${iconSvg("chevronDown", 16)}</span></button><div class="map-side-panel-content" id="risk-map-controls">
        <div class="map-empty-banner" role="status" hidden>${iconSvg("info", 16)}<span>No risk data yet</span><button type="button" aria-label="Dismiss" title="Dismiss">${iconSvg("close", 16)}</button></div>
        <section class="map-panel-section search-section" aria-labelledby="risk-panel-search"><h2 class="map-panel-eyebrow" id="risk-panel-search">Search</h2><div class="map-search-area"><div class="map-search-wrap"><div class="map-search-box">${iconSvg("search", 16)}<input aria-label="Search barangay or address" role="combobox" aria-expanded="false" aria-controls="map-search-results" placeholder="Search barangay or address..."><button type="button" aria-label="Locate Tacloban City">${iconSvg("pin", 18)}</button></div><div class="map-search-results" id="map-search-results" role="listbox" aria-label="Search suggestions" hidden></div></div></div></section>
        <section class="map-panel-section view-section" aria-labelledby="risk-panel-view"><h2 class="map-panel-eyebrow" id="risk-panel-view">View</h2><div class="map-mode-slot"></div></section>
        <section class="map-panel-section layers-section" aria-labelledby="risk-panel-layers"><h2 class="map-panel-eyebrow" id="risk-panel-layers">Map layers</h2><div class="map-layer-options">${layerOptions.map(([key, label, color]) => `<label><span class="layer-dot layer-dot-${key}" style="--layer-color:${color}"></span><span>${label}</span><input type="checkbox" data-layer="${key}" checked aria-label="Toggle ${label}"></label>`).join("")}</div></section>
        <section class="map-panel-section legend-section" aria-labelledby="risk-panel-legend"><h2 class="map-panel-eyebrow" id="risk-panel-legend">Risk legend</h2><div class="map-risk-legend"><div>${riskLevels.map(([label, color]) => `<span><i style="background:${color}"></i>${label}</span>`).join("")}</div></div></section>
        <section class="map-panel-section selected-area-section" aria-labelledby="risk-panel-area"><h2 class="map-panel-eyebrow" id="risk-panel-area">Selected area</h2><div class="selected-area-slot"></div></section>
      </div><div class="map-side-panel-footer"><p>Risk estimates, not exact predictions of future fires.</p></div></aside>
      <div class="risk-map-stage"><div class="risk-map-view"></div><div class="map-loading-veil"><span class="spinner"></span><b>Preparing Tacloban risk layers</b><small>Loading forecast, incidents and map tiles</small></div>
        <div class="prediction-timeline glass-panel"><div class="timeline-heading"><div><span class="eyebrow">PREDICTION TIMELINE</span><strong>${day === 0 ? "Today" : `Today + ${day} day${day === 1 ? "" : "s"}`}</strong></div><time>${new Date(Date.now() + day * 86400000).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</time><button type="button" aria-label="Play prediction animation" ${areas.length ? "" : "disabled"}>▶</button></div><label class="timeline-range"><span class="sr-only">Prediction day</span><input type="range" min="0" max="7" value="${day}" ${areas.length ? "" : "disabled"} style="--timeline-progress:${day / 7 * 100}%"></label><div class="timeline-ticks">${days.map((label, index) => `<button type="button" class="${index === day ? "active" : ""}" data-day="${index}" ${areas.length ? "" : "disabled"} aria-label="Show risk for ${index ? `day plus ${index}` : "today"}">${label}</button>`).join("")}</div><small class="timeline-empty-note">No predictions available</small></div>
      </div></div>`;
    main.replaceChildren(layout);
    layout.querySelector(".selected-area-slot").append(createEmptyState("No area selected", "Select an area on the map to see its risk, factors and nearest station.", "pin"));
    const host = layout.querySelector(".risk-map-view");
    host.classList.add("risk-map-view");
    const panelToggle = layout.querySelector(".map-side-panel-toggle");
    panelToggle.addEventListener("click", () => {
      const content = layout.querySelector(".map-side-panel-content");
      const expanded = panelToggle.getAttribute("aria-expanded") === "true";
      panelToggle.setAttribute("aria-expanded", String(!expanded));
      content.hidden = expanded;
    });
    if (window.matchMedia("(max-width: 767px)").matches) {
      layout.querySelector(".map-side-panel-content").hidden = true;
      panelToggle.setAttribute("aria-expanded", "false");
    }
    const modeControl = createMapModeControl({ value: mode, label: "Map visualization", className: "risk-map-mode-control", onChange: (next) => {
      mode = next;
      const visible = {
        riskZones: layers.riskZones && next === "risk",
        incidents: layers.incidents && next === "risk",
        hotspots: layers.hotspots && next === "hotspots",
        fireStations: layers.fireStations && next === "stations",
      };
      for (const [key, shown] of Object.entries(visible)) layerSet?.setVisibility(key, shown);
    } });
    layout.querySelector(".map-mode-slot").append(modeControl.element);
    layout.querySelectorAll("[data-layer]").forEach((input) => input.addEventListener("change", () => {
      layers[input.dataset.layer] = input.checked;
      const modeAllows = mode === "risk" || (mode === "hotspots" && input.dataset.layer === "hotspots") || (mode === "stations" && input.dataset.layer === "fireStations");
      layerSet?.setVisibility(input.dataset.layer, input.checked && modeAllows);
    }));
    layout.querySelector(".map-empty-banner button").addEventListener("click", () => {
      showNoData = false;
      sessionStorage.setItem("risk-map-no-data-dismissed", "true");
      layout.querySelector(".map-empty-banner").hidden = true;
    });
    const timeline = layout.querySelector(".timeline-range input");
    const setDay = async (nextDay) => {
      day = nextDay;
      timeline.value = String(day);
      timeline.style.setProperty("--timeline-progress", `${day / 7 * 100}%`);
      layout.querySelector(".timeline-heading strong").textContent = day === 0 ? "Today" : `Today + ${day} day${day === 1 ? "" : "s"}`;
      layout.querySelector(".timeline-heading time").textContent = new Date(Date.now() + day * 86400000).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      layout.querySelectorAll("[data-day]").forEach((button) => button.classList.toggle("active", Number(button.dataset.day) === day));
      const params = new URLSearchParams(window.location.search);
      if (day) params.set("day", String(day)); else params.delete("day");
      window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
      try {
        const nextAreas = await fetchRiskForDay(day);
        activeAreas = nextAreas;
        layerSet?.destroy();
        layerSet = await buildLayers();
        if (!nextAreas.length) layout.querySelector(".map-empty-banner").hidden = !showNoData;
      } catch (error) {
        layout.dispatchEvent(new CustomEvent("app:toast", { bubbles: true, detail: { message: error.message || "Risk forecast could not be loaded.", type: "error" } }));
      }
    };
    timeline.addEventListener("input", () => { void setDay(Number(timeline.value)); });
    layout.querySelectorAll("[data-day]").forEach((button) => button.addEventListener("click", () => { void setDay(Number(button.dataset.day)); }));
    const playButton = layout.querySelector(".timeline-heading>button");
    let playback;
    playButton.addEventListener("click", () => {
      if (playback) {
        clearInterval(playback); playback = null;
        playButton.textContent = "▶";
        playButton.setAttribute("aria-label", "Play prediction animation");
        return;
      }
      playback = window.setInterval(() => { void setDay((day + 1) % 8); }, 1200);
      playButton.textContent = "Ⅱ";
      playButton.setAttribute("aria-label", "Pause prediction animation");
    });
    const input = layout.querySelector(".map-search-box input");
    const results = layout.querySelector(".map-search-results");
    const locate = layout.querySelector(".map-search-box button");
    locate.addEventListener("click", () => currentMap?.setView(MAP_CENTER, 12.1));
    input.addEventListener("input", () => {
      clearTimeout(debounce);
      searchController?.abort();
      const term = input.value.trim();
      input.setAttribute("aria-expanded", String(term.length >= 2));
      results.hidden = term.length < 2;
      if (term.length < 2) return;
      results.innerHTML = '<span class="search-loading">Searching Tacloban...</span>';
      debounce = window.setTimeout(async () => {
        searchController = new AbortController();
        try {
          const suggestions = await nominatimSearch(term, searchController.signal);
          if (searchController.signal.aborted || input.value.trim() !== term) return;
          results.replaceChildren();
          if (!suggestions.length) { results.innerHTML = '<span class="search-loading">No places found in this area</span>'; return; }
          for (const suggestion of suggestions) {
            const button = document.createElement("button");
            button.type = "button"; button.setAttribute("role", "option");
            button.innerHTML = `${iconSvg("pin", 14)}<span>${escapeHtml(suggestion.name)}</span>`;
            button.addEventListener("click", () => {
              if (Number.isFinite(suggestion.lat) && Number.isFinite(suggestion.lng)) currentMap?.setView([suggestion.lat, suggestion.lng], 15);
              input.value = ""; input.setAttribute("aria-expanded", "false"); results.hidden = true;
            });
            results.append(button);
          }
        } catch (error) {
          if (!searchController.signal.aborted) results.innerHTML = `<span class="search-loading">${escapeHtml(error.message || "Search unavailable")}</span>`;
        }
      }, 320);
    });
    if (!areas.length) {
      layout.querySelector(".map-empty-banner").hidden = !showNoData;
      timeline.disabled = true;
    } else timeline.disabled = false;
    void weather;
  }
}

function showAreaDetails(screen, area, weather) {
  const slot = screen.querySelector(".selected-area-slot");
  if (!slot) return;
  const content = screen.querySelector(".map-side-panel-content");
  content.hidden = false;
  screen.querySelector(".map-side-panel-toggle")?.setAttribute("aria-expanded", "true");
  slot.innerHTML = `<aside class="area-detail-panel area-detail-inline" aria-label="Selected area: ${escapeHtml(area.name)}">
    <button type="button" class="area-back-controls">${iconSvg("arrow", 14)}Back to map controls</button>
    <div class="area-panel-heading"><div><span class="eyebrow">SELECTED AREA</span><h2>${escapeHtml(area.name)}</h2><p>${iconSvg("pin", 11)} Northern Tacloban · ${Number(area.areaKm2).toFixed(1)} km²</p></div></div>
    <div class="area-risk-note"><span class="area-risk-chip"></span><p>Risk is expected to remain elevated for the next 24 hours.</p></div>
    <section class="area-factors"><span class="eyebrow">PRIMARY CONTRIBUTING FACTORS</span><h3>Risk DNA</h3><div class="area-dna"></div></section>
    <div class="ai-explanation"><span>${iconSvg("flame", 15)}</span><div><b>AI risk explanation</b><p>${escapeHtml(area.explanation)}</p></div></div>
    <div class="area-weather-row"><span><b>${weather?.temperatureC ?? "—"}°</b><small>Temp</small></span><span><b>${weather?.humidityPercent ?? "—"}%</b><small>Humidity</small></span><span><b>${weather?.windKph ?? "—"}</b><small>km/h ${escapeHtml(weather?.windDirection ?? "")}</small></span></div>
    <section class="nearest-station"><div><small>NEAREST STATION</small><b>${escapeHtml(area.nearestStation.name)}</b><span>${Number(area.nearestStation.distanceKm).toFixed(1)} km · est. ${area.nearestStation.responseMinutes} min</span></div></section>
    <div class="area-actions"><a class="button button-primary" href="what-if.html?area=${encodeURIComponent(area.id)}">Run What-If</a><a class="button button-secondary" href="reports.html?area=${encodeURIComponent(area.id)}">Generate report</a></div>
  </aside>`;
  const chip = createRiskChip(area.level);
  slot.querySelector(".area-risk-chip").append(chip);
  renderRiskDna(slot.querySelector(".area-dna"), area.factors);
  slot.querySelector(".area-back-controls").addEventListener("click", () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("area");
    window.location.assign(`${window.location.pathname}${params.size ? `?${params}` : ""}`);
  });
}
