import { fetchModelEvaluation } from "../api/models.js";
import { loadChartJs, chartBaseOptions, chartColors, chartGradient, describeChart } from "../charts/theme.js";
import { openModal } from "../ui/overlays.js";
import { iconSvg } from "../ui/icons.js";
import { escapeHtml } from "../utils/dom.js";

const styles = ["phase3-pages.css", "ml-evaluation.css"];
const metrics = [["accuracy", "Accuracy"], ["precision", "Precision"], ["recall", "Recall"], ["f1", "F1 score"], ["rocAuc", "ROC-AUC"]];
function ensureStyles() {
  for (const file of styles) {
    const id = `phase3-${file}`;
    if (document.getElementById(id)) continue;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet"; link.href = `assets/css/${file}`; document.head.append(link);
  }
}
function showError(main, retry) {
  main.innerHTML = `<div class="phase3-page"><div class="query-error" role="alert"><b>Model evaluation data could not be loaded.</b><button type="button" class="button button-primary">Retry</button></div></div>`;
  main.querySelector("button").addEventListener("click", retry);
}
export async function mount(main, user) {
  ensureStyles();
  main.innerHTML = `<div class="phase3-page phase3-loading"><div class="skeleton phase3-title-skeleton"></div><div class="model-skeleton-grid">${Array.from({ length: 4 }, () => '<div class="skeleton"></div>').join("")}</div><div class="model-skeleton-panels"><div class="skeleton"></div><div class="skeleton"></div></div></div>`;
  const load = async () => {
    try { render(main, user, await fetchModelEvaluation()); }
    catch { showError(main, load); }
  };
  await load();
}
function render(main, user, modelData) {
  const canSelectModel = user?.role === "analyst" || user?.role === "admin";
  let fileName = modelData.fileName || "";
  let uploadedRecords = Number(modelData.uploadedRecords) || 0;
  let currentMetric = "accuracy";
  let uploadTimer;
  main.innerHTML = `<div class="phase3-page ml-page"><header class="phase3-heading"><div><span class="eyebrow">ANALYST WORKSPACE</span><h1>ML model evaluation</h1><p>Compare candidate models and monitor data preparation.</p></div><button type="button" class="button button-primary upload-dataset">${iconSvg("file", 14)}Upload dataset</button></header>
    <div class="model-cards-grid">${modelData.models.length ? modelData.models.map((model) => `<div class="model-card"><span class="model-icon">${iconSvg("sparkle", 15)}</span><b class="model-name">${escapeHtml(model.name)}</b><div class="model-accuracy"><strong>${Number(model.metrics.accuracy).toFixed(1)}%</strong><small>Accuracy</small></div><div class="model-mini-metrics">${metrics.slice(1).map(([key, label]) => `<span><small>${label}</small><b>${Number(model.metrics[key]).toFixed(1)}%</b></span>`).join("")}</div></div>`).join("") : '<div class="empty-list-state">Not trained yet</div>'}</div>
    <div class="ml-main-grid"><section class="surface-card confusion-card"><div class="ml-panel-heading"><div><span class="eyebrow">${modelData.models[0]?.name.toUpperCase() || "NO MODEL SELECTED"}</span><h2>Confusion matrix</h2></div></div><div class="empty-list-state">No validated model is available.</div></section>
      <section class="surface-card dataset-card"><span class="eyebrow dataset-name">${escapeHtml(fileName.toUpperCase())}</span><h2>Dataset preparation</h2><div class="dataset-steps"></div><div class="model-confidence-meta"><small>No model confidence available.</small></div><button type="button" class="button button-primary retrain-button" disabled>${iconSvg("sparkle", 14)}Retrain selected model</button></section></div>
    <section class="surface-card chart-card model-comparison-card"><header class="chart-card-heading"><div><span class="eyebrow">CANDIDATE MODELS</span><h2>Model metric comparison</h2></div><div class="metric-chart-toolbar"><label><span class="visually-hidden">Metric to compare</span><select>${metrics.map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></label></div></header><div class="model-comparison-chart"><canvas aria-label="Compare model accuracy scores" role="img"></canvas></div>${modelData.models.length ? "" : '<div class="chart-empty-note">No data yet</div>'}</section>`;
  main.querySelector(".upload-dataset").addEventListener("click", () => openUploadModal(main, (name, count) => {
    fileName = name; uploadedRecords = count;
    main.querySelector(".dataset-name").textContent = name.toUpperCase();
    main.dispatchEvent(new CustomEvent("app:toast", { bubbles: true, detail: { message: `${name} uploaded successfully.`, type: "success" } }));
  }));
  const canvas = main.querySelector("canvas");
  const renderChart = async () => {
    const Chart = await loadChartJs();
    canvas.chartInstance?.destroy?.();
    const selectedMetric = metrics.find(([key]) => key === currentMetric)?.[1] ?? currentMetric;
    const summary = modelData.models.length
      ? modelData.models.map((model) => `${model.name}: ${Number.isFinite(Number(model.metrics[currentMetric])) ? Number(model.metrics[currentMetric]) : "unavailable"} percent ${selectedMetric.toLowerCase()}`).join("; ")
      : "No candidate models have been trained.";
    describeChart(canvas, `Compare model ${currentMetric} scores`, summary);
    canvas.chartInstance = new Chart(canvas, {
      type: "bar",
      data: { labels: modelData.models.map((model) => model.name), datasets: [{ label: selectedMetric, data: modelData.models.map((model) => model.metrics[currentMetric]), backgroundColor: (context) => chartGradient(context, chartColors.brandAccent, 0.9), borderRadius: 4, borderSkipped: false, maxBarThickness: 42 }] },
      options: { ...chartBaseOptions, indexAxis: "y", plugins: { ...chartBaseOptions.plugins, legend: { display: false }, tooltip: { ...chartBaseOptions.plugins.tooltip, callbacks: { label: (item) => `${item.raw}%` } } }, scales: {
        x: { ...chartBaseOptions.scales.x, min: 0, max: 100, grid: { color: chartColors.grid }, ticks: { ...chartBaseOptions.scales.x.ticks, callback: (value) => `${value}%` } },
        y: { ...chartBaseOptions.scales.y, grid: { display: false } },
      } },
    });
  };
  main.querySelector(".metric-chart-toolbar select").addEventListener("change", (event) => { currentMetric = event.target.value; void renderChart(); });
  void renderChart();
}

function openUploadModal(main, onUploaded) {
  const content = document.createElement("div");
  content.className = "dataset-upload-content";
  content.innerHTML = `<p class="upload-intro">Upload a CSV dataset to add records to the preparation workspace.</p><input class="sr-only" type="file" accept=".csv,text/csv" aria-label="Choose a CSV dataset"><div class="upload-dropzone" role="group" tabindex="0" aria-label="Choose a CSV file or drop it here"><span class="upload-icon">${iconSvg("file", 22)}</span><span class="upload-prompt"><b>Choose a CSV file or drop it here</b><small>.csv only · Maximum file size 10 MB</small></span><span class="upload-file-details" hidden><b class="upload-file-name"></b><small class="upload-file-size"></small><button type="button" class="upload-remove">Remove</button></span></div><div class="upload-validation" role="alert" hidden></div><div class="upload-progress-wrap" hidden><div class="upload-progress"><i></i></div><small>Uploading <span>0%</span></small></div>`;
  const footer = document.createElement("footer");
  footer.className = "dialog-actions upload-modal-footer";
  footer.innerHTML = `<button type="button" class="button button-secondary overlay-cancel">Cancel</button><button type="button" class="button button-primary upload-done" disabled>Done</button>`;
  const fileInput = content.querySelector("input");
  const dropzone = content.querySelector(".upload-dropzone");
  const error = content.querySelector(".upload-validation");
  const progress = content.querySelector(".upload-progress-wrap");
  const prompt = content.querySelector(".upload-prompt");
  const fileDetails = content.querySelector(".upload-file-details");
  const removeButton = content.querySelector(".upload-remove");
  const doneButton = footer.querySelector(".upload-done");
  let selectedFile = null;
  let progressValue = 0;
  const validate = (file) => {
    error.hidden = true; error.textContent = "";
    if (!file) return;
    clearInterval(uploadTimer);
    selectedFile = null;
    doneButton.disabled = true;
    prompt.hidden = false;
    fileDetails.hidden = true;
    progress.hidden = true;
    if (!file.name.toLowerCase().endsWith(".csv") || (file.type && file.type !== "text/csv" && file.type !== "application/vnd.ms-excel")) {
      error.textContent = "Choose a CSV file."; error.hidden = false; selectedFile = null; return;
    }
    if (file.size > 10 * 1024 * 1024) {
      error.textContent = "File must be 10 MB or smaller."; error.hidden = false; selectedFile = null; return;
    }
    selectedFile = file;
    content.querySelector(".upload-file-name").textContent = file.name;
    content.querySelector(".upload-file-size").textContent = file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      : file.size >= 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${file.size} B`;
    prompt.hidden = true;
    fileDetails.hidden = false;
    doneButton.disabled = false;
    progress.hidden = false; progressValue = 0;
    progress.querySelector(".upload-progress i").style.width = "0%";
    progress.querySelector("small span").textContent = "0%";
    clearInterval(uploadTimer);
    uploadTimer = window.setInterval(async () => {
      progressValue = Math.min(100, progressValue + 8);
      progress.querySelector(".upload-progress i").style.width = `${progressValue}%`;
      progress.querySelector("small span").textContent = `${progressValue}%`;
      if (progressValue >= 100) {
        clearInterval(uploadTimer);
        try {
          const contents = await selectedFile.text();
          const records = contents.split(/\r?\n/).filter((line) => line.trim()).length > 0
            ? Math.max(0, contents.split(/\r?\n/).filter((line) => line.trim()).length - 1) : 0;
          onUploaded(selectedFile.name, records);
          close();
        } catch (uploadError) {
          error.textContent = uploadError instanceof Error ? `Could not read the selected file: ${uploadError.message}` : "Could not read the selected file.";
          error.hidden = false;
        }
      }
    }, 90);
  };
  fileInput.addEventListener("change", () => validate(fileInput.files?.[0]));
  dropzone.addEventListener("click", (event) => {
    if (event.target.closest(".upload-remove")) return;
    fileInput.click();
  });
  dropzone.addEventListener("keydown", (event) => {
    if (event.target === dropzone && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      fileInput.click();
    }
  });
  dropzone.addEventListener("dragover", (event) => { event.preventDefault(); dropzone.classList.add("dragging"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
  dropzone.addEventListener("drop", (event) => { event.preventDefault(); dropzone.classList.remove("dragging"); validate(event.dataTransfer.files?.[0]); });
  removeButton.addEventListener("click", () => {
    clearInterval(uploadTimer);
    selectedFile = null;
    fileInput.value = "";
    fileDetails.hidden = true;
    prompt.hidden = false;
    progress.hidden = true;
    error.hidden = true;
    error.textContent = "";
    doneButton.disabled = true;
  });
  const close = openModal({ title: "Upload dataset", content, footer });
  document.querySelector(".modal-panel")?.classList.add("dataset-upload-modal");
  doneButton.addEventListener("click", close);
  footer.querySelector(".overlay-cancel").addEventListener("click", () => clearInterval(uploadTimer));
  return close;
}
