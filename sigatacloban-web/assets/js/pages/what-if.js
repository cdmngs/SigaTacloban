import { fetchWhatIfAreas, simulateRisk } from "../api/whatif.js";
import { renderGauge } from "../ui/gauge.js";
import { renderRiskDna } from "../ui/risk-dna-bars.js";
import { createRiskChip } from "../ui/risk-chip.js";
import { createEmptyState } from "../ui/empty-state.js";
import { iconSvg } from "../ui/icons.js";
import { escapeHtml } from "../utils/dom.js";

const styles = ["phase3-pages.css", "whatif.css"];
const presets = {
  "Hot and dry": { temperatureC: 35, humidityPercent: 42, rainfallMm: 0, windKph: 28 },
  "Typhoon rain": { temperatureC: 28, humidityPercent: 92, rainfallMm: 24, windKph: 55 },
  "Strong wind": { temperatureC: 33, humidityPercent: 54, rainfallMm: 0, windKph: 48 },
};
const rows = [
  ["temperatureC", "Temperature", "°C", 20, 45, 1, "thermometer"],
  ["humidityPercent", "Humidity", "%", 10, 100, 1, "droplet"],
  ["rainfallMm", "Rainfall", "mm", 0, 30, 0.1, "rain"],
  ["windKph", "Wind speed", "km/h", 0, 60, 1, "wind"],
];

function ensureStyles() {
  for (const file of styles) {
    const id = `phase3-${file}`;
    if (document.getElementById(id)) continue;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet"; link.href = `assets/css/${file}`; document.head.append(link);
  }
}
function showError(main, retry) {
  main.innerHTML = `<div class="phase3-page"><div class="query-error" role="alert"><b>Barangay scenario data could not be loaded.</b><button type="button" class="button button-primary">Retry</button></div></div>`;
  main.querySelector("button").addEventListener("click", retry);
}

export async function mount(main) {
  ensureStyles();
  main.innerHTML = `<div class="phase3-page phase3-loading"><div class="skeleton phase3-title-skeleton"></div><div class="whatif-skeleton-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div>`;
  try {
    const areas = await fetchWhatIfAreas();
    render(main, areas);
  } catch { showError(main, () => mount(main)); }
}

function getSavedScenarios() {
  const stored = localStorage.getItem("sigatacloban-phase3");
  if (!stored) return [];
  const state = JSON.parse(stored);
  const savedScenarios = state.state?.savedScenarios ?? state.savedScenarios;
  return Array.isArray(savedScenarios) ? savedScenarios : [];
}
function storeSavedScenarios(scenarios) {
  const stored = localStorage.getItem("sigatacloban-phase3");
  const state = stored ? JSON.parse(stored) : {};
  const nestedState = state.state && typeof state.state === "object" ? state.state : state;
  localStorage.setItem("sigatacloban-phase3", JSON.stringify({ ...state, state: { ...nestedState, savedScenarios: scenarios } }));
}

function render(main, areas) {
  let area = areas[0] ?? null;
  let conditions = area?.currentConditions ? { ...area.currentConditions } : {};
  let selectedPreset = area ? "Current" : "";
  let savedScenarios;
  try { savedScenarios = getSavedScenarios(); }
  catch (error) { showError(main, () => mount(main)); throw error; }
  if (!window.SigaTacloban) window.SigaTacloban = {};
  window.SigaTacloban.simulateRisk = simulateRisk;
  main.innerHTML = `<div class="phase3-page whatif-page">
    <header class="phase3-heading"><div><span class="eyebrow">SCENARIO PLANNING</span><h1>What-If simulation</h1><p>Adjust environmental conditions to explore how risk may change.</p></div><button type="button" class="button button-secondary button-sm reset-current">${iconSvg("arrow", 13)}Reset to current</button></header>
    <div class="whatif-grid">
      <section class="surface-card scenario-condition-card"><span class="eyebrow scenario-area-label">${area ? escapeHtml(area.name.toUpperCase()) : "NO AREAS"} · SCENARIO CONDITIONS</span><div class="whatif-card-heading"><h2>Scenario conditions</h2><label class="visually-hidden" for="scenario-area">Select barangay</label><select id="scenario-area" ${areas.length ? "" : "disabled"}>${areas.length ? areas.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("") : '<option value="">No areas available</option>'}</select></div>
        <div class="scenario-controls">${rows.map(([key, label, suffix, min, max, step, icon]) => {
          const value = conditions[key] ?? min;
          const disabled = area ? "" : "disabled";
          return `<div class="scenario-control" data-key="${key}"><div class="scenario-control-label"><span>${iconSvg(icon, 15)}<b>${label}</b></span><label><span class="visually-hidden">${label} value</span><input type="number" data-value="${key}" min="${min}" max="${max}" step="${step}" value="${value}" ${disabled}><b>${suffix}</b></label></div><div class="slider-field"><input type="range" data-range="${key}" aria-label="${label} slider" min="${min}" max="${max}" step="${step}" value="${value}" data-suffix="${suffix}" ${disabled}></div></div>`;
        }).join("")}</div>
        <div class="scenario-presets" role="group" aria-label="Scenario presets">${["Current", ...Object.keys(presets)].map((name) => `<button type="button" class="${name === selectedPreset ? "active" : ""}" data-preset="${escapeHtml(name)}" ${area ? "" : "disabled"}>${escapeHtml(name)}</button>`).join("")}</div>
      </section>
      <section class="surface-card risk-impact-card"><span class="eyebrow">MODEL ESTIMATE</span><h2>Risk impact</h2><div class="risk-impact-content"></div></section>
      <section class="surface-card updated-dna-card"><span class="eyebrow">LIVE CONTRIBUTION CHANGES</span><h2>Updated Risk DNA</h2><div class="updated-dna-content"></div></section>
    </div>
    <div class="saved-scenario-tools"><div class="save-scenario-form"><label class="visually-hidden" for="scenario-name">Scenario name</label><input id="scenario-name" placeholder="Name this scenario (optional)"><button type="button" class="button button-primary button-sm save-scenario">${iconSvg("file", 13)}Save scenario</button></div><details class="saved-scenarios"><summary>Saved scenarios <span>${savedScenarios.length}</span></summary><div class="saved-scenario-list"></div></details></div>
    <p class="whatif-disclaimer">Risk estimates, not exact predictions of future fires.</p>
  </div>`;

  const renderResult = () => {
    const impact = main.querySelector(".risk-impact-content");
    const dna = main.querySelector(".updated-dna-content");
    if (!area) {
      impact.replaceChildren(createEmptyState("No areas available", "Select a barangay to view its risk impact.", "activity"));
      dna.replaceChildren(createEmptyState("No risk factors available", "Risk DNA appears when an area is selected.", "chart"));
      return;
    }
    const result = simulateRisk(area, conditions);
    impact.innerHTML = `<div class="gauge-comparison"><div><div class="baseline-gauge"></div><small>Current</small></div><span class="impact-arrow" aria-hidden="true">→</span><div><div class="scenario-gauge"></div><small>Scenario</small></div></div><div class="impact-delta ${result.delta > 0 ? "delta-up" : result.delta < 0 ? "delta-down" : "delta-neutral"}" aria-live="polite"><b>${result.delta > 0 ? "+" : ""}${result.delta} points</b><span>Risk ${result.delta > 0 ? "increases" : result.delta < 0 ? "decreases" : "is unchanged"} to ${result.level === "veryhigh" ? "Very High" : result.level[0].toUpperCase() + result.level.slice(1)}</span><span class="result-chip"></span></div><p class="impact-explanation" aria-live="polite">${conditions.temperatureC === area.currentConditions.temperatureC && conditions.humidityPercent === area.currentConditions.humidityPercent && conditions.rainfallMm === area.currentConditions.rainfallMm && conditions.windKph === area.currentConditions.windKph ? "Current environmental conditions are unchanged from the baseline." : "Adjustments to current conditions change ignition and spread potential for this area."}</p>`;
    renderGauge(impact.querySelector(".baseline-gauge"), area.whatIfBaseline, { lowMax: 39, moderateMax: 59, highMax: 79 });
    renderGauge(impact.querySelector(".scenario-gauge"), result.score, { lowMax: 39, moderateMax: 59, highMax: 79 });
    const chip = createRiskChip(result.level);
    impact.querySelector(".result-chip").append(chip);
    renderRiskDna(dna, result.factors);
    dna.insertAdjacentHTML("beforeend", `<div class="model-confidence"><span>${iconSvg("sparkle",16)}</span><div><b>Model confidence 89%</b><small>Random Forest v2.4</small></div></div>`);
  };
  const renderSaved = () => {
    main.querySelector(".saved-scenarios summary span").textContent = String(savedScenarios.length);
    const list = main.querySelector(".saved-scenario-list");
    list.innerHTML = savedScenarios.length ? savedScenarios.map((scenario) => `<div><span><b>${escapeHtml(scenario.name)}</b><small>${escapeHtml(scenario.areaName)} · score ${scenario.score}</small></span><button type="button" data-delete="${escapeHtml(scenario.id)}" aria-label="Delete ${escapeHtml(scenario.name)}">${iconSvg("close", 14)}</button></div>`).join("") : "<p>No saved scenarios yet.</p>";
    list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
      savedScenarios = savedScenarios.filter((item) => item.id !== button.dataset.delete);
      storeSavedScenarios(savedScenarios);
      renderSaved();
    }));
  };
  const setConditions = (next, preset = "") => {
    if (!area) return;
    conditions = { ...next };
    selectedPreset = preset;
    for (const [key] of rows) {
      const value = main.querySelector(`[data-value="${key}"]`);
      const range = main.querySelector(`[data-range="${key}"]`);
      value.value = String(conditions[key]);
      range.value = String(conditions[key]);
      updateRange(range);
    }
    main.querySelectorAll("[data-preset]").forEach((button) => button.classList.toggle("active", button.dataset.preset === preset));
    renderResult();
  };
  const updateRange = (range) => {
    const min = Number(range.min); const max = Number(range.max); const value = Number(range.value);
    range.style.setProperty("--range-progress", `${((value - min) / (max - min)) * 100}%`);
  };
  for (const [key] of rows) {
    const number = main.querySelector(`[data-value="${key}"]`);
    const range = main.querySelector(`[data-range="${key}"]`);
    number.addEventListener("input", () => {
      if (number.value === "") return;
      const [, , , minimum, maximum] = rows.find(([rowKey]) => rowKey === key);
      const clamped = Math.max(minimum, Math.min(maximum, Number(number.value)));
      conditions[key] = key === "rainfallMm" ? Math.round(clamped * 10) / 10 : Math.round(clamped);
      number.value = String(conditions[key]);
      range.value = number.value; updateRange(range); selectedPreset = "";
      main.querySelectorAll("[data-preset]").forEach((button) => button.classList.remove("active"));
      renderResult();
    });
    range.addEventListener("input", () => {
      conditions[key] = key === "rainfallMm" ? Math.round(Number(range.value) * 10) / 10 : Math.round(Number(range.value));
      number.value = String(conditions[key]); updateRange(range); selectedPreset = "";
      main.querySelectorAll("[data-preset]").forEach((button) => button.classList.remove("active"));
      renderResult();
    });
    updateRange(range);
  }
  main.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.preset === "Current") setConditions(area?.currentConditions ?? {}, "Current");
    else setConditions(presets[button.dataset.preset], button.dataset.preset);
  }));
  main.querySelector(".reset-current").addEventListener("click", () => {
    if (area) setConditions(area.currentConditions ?? {}, "Current");
  });
  main.querySelector(".save-scenario").addEventListener("click", () => {
    if (!area) return;
    const result = simulateRisk(area, conditions);
    const input = main.querySelector("#scenario-name");
    const name = input.value.trim() || `${area.name} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    savedScenarios.unshift({ id: crypto.randomUUID(), name, areaId: area.id, areaName: area.name, conditions: { ...conditions }, score: result.score, level: result.level, savedAt: new Date().toISOString() });
    storeSavedScenarios(savedScenarios);
    input.value = "";
    renderSaved();
  });
  main.querySelector("#scenario-area").addEventListener("change", (event) => {
    area = areas.find((item) => item.id === event.target.value) ?? null;
    conditions = area?.currentConditions ? { ...area.currentConditions } : {};
    selectedPreset = area ? "Current" : "";
    main.querySelector(".scenario-area-label").textContent = `${area?.name.toUpperCase() ?? "NO AREAS"} · SCENARIO CONDITIONS`;
    for (const [key, , , min] of rows) {
      const value = main.querySelector(`[data-value="${key}"]`);
      value.value = String(conditions[key] ?? min);
      value.disabled = !area;
      const range = main.querySelector(`[data-range="${key}"]`);
      range.value = String(conditions[key] ?? min);
      range.disabled = !area;
      updateRange(range);
    }
    main.querySelectorAll("[data-preset]").forEach((button) => {
      button.disabled = !area;
      button.classList.toggle("active", button.dataset.preset === selectedPreset);
    });
    renderResult();
  });
  renderResult();
  renderSaved();
}
