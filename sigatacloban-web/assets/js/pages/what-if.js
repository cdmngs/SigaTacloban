import { fetchWhatIfAreas, simulateWhatIf, listScenarios, saveScenario, deleteScenario, simulateRisk } from "../api/whatif.js";
import { fetchRiskArea } from "../api/risk.js";
import { renderGauge } from "../ui/gauge.js";
import { renderRiskDna } from "../ui/risk-dna-bars.js";
import { createRiskChip } from "../ui/risk-chip.js";
import { createEmptyState } from "../ui/empty-state.js";
import { loadData, submitFormAction } from "../core/data-state.js";
import { setSharedData } from "../core/store.js";
import { showToast } from "../ui/toast.js";
import { iconSvg } from "../ui/icons.js";
import { escapeHtml } from "../utils/dom.js";
import { formatNumber, formatValue } from "../utils/format.js";

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

export async function mount(main) {
  ensureStyles();
  main.innerHTML = `<div class="phase3-page phase3-loading"><div class="skeleton phase3-title-skeleton"></div><div class="whatif-skeleton-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div>`;
  const areasLoader = loadData((signal) => fetchWhatIfAreas({ signal }), [], {
    container: main,
    emptyTitle: "No areas available",
    emptyMessage: "No areas are available for scenario planning.",
    errorTitle: "Barangay scenario data could not be loaded",
    success: (_container, areas) => render(main, Array.isArray(areas) ? areas : []),
  });
  await areasLoader.load();
}

function render(main, areas) {
  let area = null;
  let conditions = {};
  let selectedPreset = "";
  let savedScenarios = [];
  let latestSimulation = null;
  let simulationTimer;
  let scenarioLoader;
  let simulationLoader;
  if (!window.SigaTacloban) window.SigaTacloban = {};
  window.SigaTacloban.simulateRisk = simulateRisk;
  const requestedArea = new URLSearchParams(location.search).get("area");
  main.innerHTML = `<div class="phase3-page whatif-page">
    <header class="phase3-heading"><div><span class="eyebrow">SCENARIO PLANNING</span><h1>What-If simulation</h1><p>Adjust environmental conditions to explore how risk may change.</p></div><button type="button" class="button button-secondary button-sm reset-current" ${areas.length ? "" : "disabled"}>${iconSvg("arrow", 13)}Reset to current</button></header>
    ${areas.length ? "" : '<p class="whatif-empty-message">No areas available</p>'}
    <div class="whatif-grid">
      <section class="surface-card scenario-condition-card"><span class="eyebrow scenario-area-label">${areas.length ? "SELECT AN AREA" : "NO AREAS"} · SCENARIO CONDITIONS</span><div class="whatif-card-heading"><h2>Scenario conditions</h2><label class="visually-hidden" for="scenario-area">Select barangay</label><select id="scenario-area" ${areas.length ? "" : "disabled"}>${areas.length ? `<option value="">Select a barangay</option>${areas.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === requestedArea ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}` : '<option value="">No areas available</option>'}</select></div>
        <div class="scenario-controls">${rows.map(([key, label, suffix, min, max, step, icon]) => `<div class="scenario-control" data-key="${key}"><div class="scenario-control-label"><span>${iconSvg(icon, 15)}<b>${label}</b></span><label><span class="visually-hidden">${label} value</span><input type="number" data-value="${key}" min="${min}" max="${max}" step="${step}" value="${min}" disabled><b>${suffix}</b></label></div><div class="slider-field"><input type="range" data-range="${key}" aria-label="${label} slider" min="${min}" max="${max}" step="${step}" value="${min}" data-suffix="${suffix}" disabled></div></div>`).join("")}</div>
        <div class="scenario-presets" role="group" aria-label="Scenario presets">${["Current", ...Object.keys(presets)].map((name) => `<button type="button" class="${name === selectedPreset ? "active" : ""}" data-preset="${escapeHtml(name)}" disabled>${escapeHtml(name)}</button>`).join("")}</div>
      </section>
      <section class="surface-card risk-impact-card"><span class="eyebrow">MODEL ESTIMATE</span><h2>Risk impact</h2><div class="risk-impact-content"></div></section>
      <section class="surface-card updated-dna-card"><span class="eyebrow">LIVE CONTRIBUTION CHANGES</span><h2>Updated Risk DNA</h2><div class="updated-dna-content"></div></section>
    </div>
    <div class="saved-scenario-tools"><form class="save-scenario-form"><label class="visually-hidden" for="scenario-name">Scenario name</label><input id="scenario-name" placeholder="Name this scenario (optional)" ${areas.length ? "" : "disabled"}><button type="submit" class="button button-primary button-sm save-scenario" ${areas.length ? "disabled" : "disabled"}>${iconSvg("file", 13)}Save scenario</button></form><details class="saved-scenarios"><summary>Saved scenarios <span>0</span></summary><div class="saved-scenario-list"></div></details></div>
    <p class="whatif-disclaimer">Risk estimates, not exact predictions of future fires.</p>
  </div>`;
  const impact = main.querySelector(".risk-impact-content");
  const dna = main.querySelector(".updated-dna-content");
  const selector = main.querySelector("#scenario-area");
  const renderConditions = (next, preset = "") => {
    conditions = { ...next };
    selectedPreset = preset;
    for (const [key, , , minimum] of rows) {
      const value = Number(conditions[key]);
      const input = main.querySelector(`[data-value="${key}"]`);
      const range = main.querySelector(`[data-range="${key}"]`);
      input.value = String(Number.isFinite(value) ? value : minimum);
      range.value = input.value;
      input.disabled = !area;
      range.disabled = !area;
      updateRange(range);
    }
    main.querySelectorAll("[data-preset]").forEach((button) => {
      button.disabled = !area;
      button.classList.toggle("active", button.dataset.preset === preset);
    });
    latestSimulation = null;
    main.querySelector(".save-scenario").disabled = true;
    scheduleSimulation();
  };
  const renderSaved = () => {
    const summaryCount = main.querySelector(".saved-scenarios summary span");
    const list = main.querySelector(".saved-scenario-list");
    summaryCount.textContent = String(savedScenarios.length);
    if (!savedScenarios.length) {
      list.replaceChildren(createEmptyState("No saved scenarios", "Saved scenarios for this area will appear here.", "activity"));
      return;
    }
    list.innerHTML = savedScenarios.map((scenario) => `<div class="saved-scenario-row"><button type="button" data-load-scenario="${escapeHtml(scenario.id)}"><b>${escapeHtml(scenario.name || "Untitled scenario")}</b><small>${escapeHtml(scenario.areaName || area?.name || "Area")} · score ${escapeHtml(formatValue(scenario.riskScore ?? scenario.score))}</small></button><button type="button" data-delete="${escapeHtml(scenario.id)}" aria-label="Delete ${escapeHtml(scenario.name || "scenario")}">${iconSvg("close", 14)}</button></div>`).join("");
    list.querySelectorAll("[data-load-scenario]").forEach((button) => button.addEventListener("click", () => {
      const scenario = savedScenarios.find((item) => item.id === button.dataset.loadScenario);
      if (!scenario) return;
      if (scenario.areaId && scenario.areaId !== area?.id) {
        selector.value = scenario.areaId;
        void selectArea(scenario.areaId).then(() => renderConditions(scenario.conditions || {}, ""));
      } else renderConditions(scenario.conditions || {}, "");
    }));
    list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await deleteScenario(button.dataset.delete);
        savedScenarios = savedScenarios.filter((item) => item.id !== button.dataset.delete);
        renderSaved();
        showToast("Scenario deleted.", "success");
      } catch (error) {
        button.disabled = false;
        showToast(error.message || "Scenario could not be deleted.", "error");
      }
    }));
  };
  const loadScenarios = async (areaId) => {
    scenarioLoader?.destroy();
    scenarioLoader = loadData((id, signal) => listScenarios(id, { signal }), [areaId], {
      container: main.querySelector(".saved-scenario-list"),
      loading(container) { container.innerHTML = '<div class="skeleton"></div>'; },
      emptyTitle: "No saved scenarios",
      emptyMessage: "Saved scenarios for this area will appear here.",
      errorTitle: "Saved scenarios could not be loaded",
      success(_container, data) {
        savedScenarios = Array.isArray(data) ? data : [];
        renderSaved();
      },
    });
    await scenarioLoader.load();
  };
  const renderSimulation = (result) => {
    const baseline = Number(area?.whatIfBaseline ?? area?.riskScore ?? area?.score);
    const score = Number(result?.riskScore ?? result?.score);
    const difference = Number(result?.delta ?? (score - baseline));
    if (!Number.isFinite(score) || !Number.isFinite(baseline)) {
      impact.replaceChildren(createEmptyState("Risk estimate unavailable", "The API did not return valid current and scenario scores.", "info"));
      return;
    }
    const baselineLevel = area?.riskLevel || area?.level || levelFor(baseline);
    const scenarioLevel = result.riskLevel || result.level || levelFor(score);
    impact.innerHTML = `<div class="gauge-comparison"><div><div class="baseline-gauge"></div><small>Current</small><span class="baseline-score"></span><span class="baseline-level"></span></div><span class="impact-arrow" aria-hidden="true">→</span><div><div class="scenario-gauge"></div><small>Scenario</small><span class="scenario-score"></span><span class="scenario-level"></span></div></div><div class="impact-delta ${difference > 0 ? "delta-up" : difference < 0 ? "delta-down" : "delta-neutral"}" aria-live="polite"><b>${difference > 0 ? "+" : ""}${formatNumber(difference)} points</b><span>Risk ${difference > 0 ? "increases" : difference < 0 ? "decreases" : "is unchanged"} to ${escapeHtml(String(scenarioLevel))}</span><span class="result-chip"></span></div>${result.explanation ? `<p class="impact-explanation" aria-live="polite">${escapeHtml(result.explanation)}</p>` : ""}`;
    renderGauge(impact.querySelector(".baseline-gauge"), baseline);
    renderGauge(impact.querySelector(".scenario-gauge"), score);
    impact.querySelector(".baseline-score").textContent = formatNumber(baseline);
    impact.querySelector(".scenario-score").textContent = formatNumber(score);
    impact.querySelector(".baseline-level").replaceChildren(createRiskChip(baselineLevel));
    impact.querySelector(".scenario-level").replaceChildren(createRiskChip(scenarioLevel));
    impact.querySelector(".result-chip").replaceChildren(createRiskChip(scenarioLevel));
    const factors = result.factors || result.riskFactors;
    if (Array.isArray(factors) && factors.length) renderRiskDna(dna, factors);
    else dna.replaceChildren(createEmptyState("No risk factors returned", "The simulation response did not include updated factors.", "chart"));
    latestSimulation = result;
    main.querySelector(".save-scenario").disabled = false;
  };
  const scheduleSimulation = () => {
    clearTimeout(simulationTimer);
    if (!area || !Object.keys(conditions).length) {
      impact.replaceChildren(createEmptyState("No areas available", "Select an area to view its risk impact.", "activity"));
      dna.replaceChildren(createEmptyState("No risk factors available", "Risk DNA appears when an area is selected.", "chart"));
      return;
    }
    simulationTimer = window.setTimeout(() => {
      simulationLoader?.destroy();
      simulationLoader = loadData((payload, signal) => simulateWhatIf(payload, { signal }), [{ areaId: area.id, ...conditions }], {
        container: impact,
        loading(container) { container.innerHTML = '<div class="skeleton"></div>'; },
        errorTitle: "Risk simulation failed",
        errorMessage: "Retry to estimate this scenario.",
        success(_container, result) { renderSimulation(result); },
      });
      void simulationLoader.load();
    }, 250);
  };
  const selectArea = async (id) => {
    const selected = areas.find((item) => item.id === id);
    area = selected || null;
    conditions = {};
    setSharedData({ selectedBarangay: area?.id || null });
    main.querySelector(".scenario-area-label").textContent = `${area?.name.toUpperCase() || "NO AREAS"} · SCENARIO CONDITIONS`;
    for (const [key] of rows) {
      main.querySelector(`[data-value="${key}"]`).disabled = true;
      main.querySelector(`[data-range="${key}"]`).disabled = true;
    }
    main.querySelectorAll("[data-preset]").forEach((button) => { button.disabled = true; button.classList.remove("active"); });
    main.querySelector(".save-scenario").disabled = true;
    if (!area) {
      conditions = {};
      scheduleSimulation();
      savedScenarios = [];
      renderSaved();
      return;
    }
    impact.innerHTML = '<div class="skeleton"></div>';
    dna.innerHTML = '<div class="skeleton"></div>';
    const loader = loadData((areaId, signal) => fetchRiskArea(areaId, 0, { signal }), [area.id], {
      container: impact,
      loading(container) { container.innerHTML = '<div class="skeleton"></div>'; },
      errorTitle: "Current area conditions could not be loaded",
      success(_container, detail) {
        area = { ...selected, ...detail };
        conditions = { ...(area.currentConditions || {}) };
        selectedPreset = "Current";
        renderConditions(conditions, selectedPreset);
      },
    });
    await loader.load();
    await loadScenarios(id);
  };
  const updateRange = (range) => {
    const min = Number(range.min), max = Number(range.max), value = Number(range.value);
    range.style.setProperty("--range-progress", `${((value - min) / (max - min)) * 100}%`);
  };
  for (const [key, , , min, max] of rows) {
    const number = main.querySelector(`[data-value="${key}"]`);
    const range = main.querySelector(`[data-range="${key}"]`);
    const update = (value) => {
      const numeric = Math.max(min, Math.min(max, Number(value)));
      conditions[key] = key === "rainfallMm" ? Math.round(numeric * 10) / 10 : Math.round(numeric);
      number.value = String(conditions[key]);
      range.value = number.value;
      updateRange(range);
      selectedPreset = "";
      main.querySelectorAll("[data-preset]").forEach((button) => button.classList.toggle("active", button.dataset.preset === ""));
      main.querySelector(".save-scenario").disabled = true;
      scheduleSimulation();
    };
    number.addEventListener("input", () => { if (number.value !== "") update(number.value); });
    range.addEventListener("input", () => update(range.value));
    updateRange(range);
  }
  main.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => {
    const name = button.dataset.preset;
    if (name === "Current") renderConditions(area?.currentConditions || conditions, name);
    else renderConditions(presets[name], name);
  }));
  main.querySelector(".reset-current").addEventListener("click", () => { if (area) renderConditions(area.currentConditions || conditions, "Current"); });
  selector.addEventListener("change", () => { void selectArea(selector.value); });
  main.querySelector(".save-scenario-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!area || !latestSimulation) return;
    const form = event.currentTarget;
    const input = main.querySelector("#scenario-name");
    const payload = {
      areaId: area.id,
      name: input.value.trim() || undefined,
      conditions: { ...conditions },
      riskScore: latestSimulation.riskScore ?? latestSimulation.score,
      riskLevel: latestSimulation.riskLevel ?? latestSimulation.level,
    };
    try {
      await submitFormAction(form, () => saveScenario(payload), {
        onSuccess: async (created) => {
          input.value = "";
          await loadScenarios(area.id);
          showToast("Scenario saved.", "success");
          if (created?.id && !savedScenarios.some((item) => item.id === created.id)) {
            savedScenarios.unshift(created);
            renderSaved();
          }
        },
      });
    } catch { /* submitFormAction renders field errors and reports the failure. */ }
  });
  impact.replaceChildren(createEmptyState(areas.length ? "Select an area" : "No areas available", areas.length ? "Choose a barangay to compare its current risk with a scenario." : "No areas are available for scenario planning.", "activity"));
  dna.replaceChildren(createEmptyState("No risk factors available", "Risk DNA appears when an area is selected.", "chart"));
  renderSaved();
  if (requestedArea && areas.some((item) => item.id === requestedArea)) {
    selector.value = requestedArea;
    void selectArea(requestedArea);
  }
}

function levelFor(score) {
  if (score >= 80) return "Very High";
  if (score >= 60) return "High";
  if (score >= 40) return "Moderate";
  return "Low";
}
