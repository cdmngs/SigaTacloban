import { fetchModelEvaluation, uploadDataset, listDatasets, retrainModel, getRetrainJob, selectActiveModel } from "../api/models.js";
import { loadChartJs, chartBaseOptions, chartColors, describeChart } from "../charts/theme.js";
import { openModal } from "../ui/overlays.js";
import { loadData } from "../core/data-state.js";
import { appStore, setSharedData } from "../core/store.js";
import { iconSvg } from "../ui/icons.js";
import { escapeHtml } from "../utils/dom.js";

const styles = ["phase3-pages.css", "ml-evalutaion.css"];
const metrics = [["accuracy", "Accuracy"], ["precision", "Precision"], ["recall", "Recall"], ["f1", "F1 score"], ["rocAuc", "ROC-AUC"]];
const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function ensureStyles() {
  for (const file of styles) {
    const id = `phase3-${file}`;
    if (document.getElementById(id)) continue;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet"; link.href = `assets/css/${file}`; document.head.append(link);
  }
}

export async function mount(main, user) {
  ensureStyles();
  main.innerHTML = `<div class="phase3-page phase3-loading"><div class="skeleton phase3-title-skeleton"></div><div class="model-skeleton-grid">${Array.from({ length: 4 }, () => '<div class="skeleton"></div>').join("")}</div><div class="model-skeleton-panels"><div class="skeleton"></div><div class="skeleton"></div></div></div>`;
  const loader = loadData(async (signal) => {
    const [evaluation, datasets] = await Promise.all([fetchModelEvaluation({ signal }), listDatasets({ signal })]);
    return { evaluation, datasets: Array.isArray(datasets) ? datasets : [] };
  }, [], {
    container: main,
    isEmpty: () => false,
    success(_container, data) { render(main, user, data, () => loader.load()); },
    error(container, error, retry) {
      container.innerHTML = `<div class="phase3-page"><div class="query-error" role="alert"><b>Model evaluation data could not be loaded.</b><small>${escapeHtml(error.message || "Check the connection and retry.")}</small><button type="button" class="button button-primary">Retry</button></div></div>`;
      container.querySelector("button").addEventListener("click", () => { void retry(); });
    },
  });
  await loader.load();
}

function percent(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)}%` : "—";
}

function render(main, user, data, reload) {
  main._modelChart?.destroy?.();
  const modelData = data.evaluation || {};
  const models = Array.isArray(modelData.models) ? modelData.models : [];
  const datasets = data.datasets || [];
  const canManage = user?.role === "analyst" || user?.role === "admin";
  let activeModel = models.find((model) => model.active)?.id || appStore.getState().activeModel || models[0]?.id || "";
  let selectedModel = models.find((model) => model.id === activeModel) || models[0] || null;
  let selectedDataset = datasets[0] || null;
  let currentMetric = "accuracy";
  let chartInstance = null;
  main.innerHTML = `<div class="phase3-page ml-page"><header class="phase3-heading"><div><span class="eyebrow">ANALYST WORKSPACE</span><h1>ML model evaluation</h1><p>Compare candidate models and monitor data preparation.</p></div><button type="button" class="button button-primary upload-dataset"${canManage ? "" : " disabled"}>${iconSvg("file", 14)}Upload dataset</button></header>
    <div class="model-cards-grid">${models.length ? models.map((model) => `<article class="model-card${model.id === activeModel ? " active-model" : ""}"><span class="model-icon">${iconSvg("sparkle", 15)}</span><b class="model-name">${escapeHtml(model.name || "Unnamed model")}${model.id === activeModel ? " · Active" : ""}</b><div class="model-accuracy"><strong>${percent(model.metrics?.accuracy)}</strong><small>Accuracy</small></div><div class="model-mini-metrics">${metrics.slice(1).map(([key, label]) => `<span><small>${label}</small><b>${percent(model.metrics?.[key])}</b></span>`).join("")}</div><button type="button" class="button button-secondary button-sm view-model" data-model="${escapeHtml(model.id)}">View evaluation</button>${canManage && model.id !== activeModel ? `<button type="button" class="button button-ghost button-sm set-active-model" data-model="${escapeHtml(model.id)}">Select model</button>` : ""}</article>`).join("") : '<div class="empty-list-state">Not trained yet</div>'}</div>
    <div class="ml-main-grid"><section class="surface-card confusion-card"><div class="ml-panel-heading"><div><span class="eyebrow confusion-model-name">${escapeHtml(selectedModel?.name?.toUpperCase() || "NO MODEL SELECTED")}</span><h2>Confusion matrix</h2></div></div><div class="confusion-content"></div></section>
      <section class="surface-card dataset-card"><span class="eyebrow dataset-name"></span><h2>Dataset preparation</h2><label class="dataset-selector-label">Dataset<select class="dataset-select" aria-label="Select dataset"></select></label><div class="dataset-steps"></div><div class="model-confidence-meta"><small class="dataset-summary"></small></div><div class="rejected-rows"></div><button type="button" class="button button-primary retrain-button"${canManage && selectedDataset?.datasetId && selectedModel ? "" : " disabled"}>${iconSvg("sparkle", 14)}Retrain selected model</button><p class="retrain-status" role="status" hidden></p></section></div>
    <section class="surface-card chart-card model-comparison-card"><header class="chart-card-heading"><div><span class="eyebrow">CANDIDATE MODELS</span><h2>Model metric comparison</h2></div><div class="metric-chart-toolbar"><label><span class="visually-hidden">Metric to compare</span><select>${metrics.map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></label></div></header><div class="model-comparison-chart"><canvas aria-label="Compare model accuracy scores" role="img"></canvas></div>${models.length ? "" : '<div class="chart-empty-note">No data yet</div>'}</section></div>`;

  const datasetSelect = main.querySelector(".dataset-select");
  datasetSelect.replaceChildren(...datasets.map((dataset) => {
    const option = document.createElement("option");
    option.value = dataset.datasetId || dataset.id || "";
    option.textContent = dataset.fileName || dataset.name || "Dataset";
    return option;
  }));
  datasetSelect.value = selectedDataset?.datasetId || selectedDataset?.id || "";
  const displayDataset = () => {
    const dataset = datasets.find((item) => (item.datasetId || item.id) === datasetSelect.value) || null;
    selectedDataset = dataset;
    main.querySelector(".dataset-name").textContent = String(dataset?.fileName || modelData.fileName || "No dataset uploaded").toUpperCase();
    const prep = dataset?.preparation || dataset?.summary || {};
    const rowsRead = prep.rowsRead ?? dataset?.uploadedRecords ?? modelData.uploadedRecords;
    const rowsRejected = prep.rowsRejected ?? 0;
    const columns = Array.isArray(prep.columns) ? prep.columns.join(", ") : prep.columns;
    const dateRange = prep.dateRange;
    main.querySelector(".dataset-summary").textContent = dataset
      ? `${rowsRead ?? "—"} rows read · ${rowsRejected} rejected${columns ? ` · Columns: ${columns}` : ""}${dateRange ? ` · ${dateRange.from || dateRange.start || "—"} to ${dateRange.to || dateRange.end || "—"}` : ""}`
      : "Upload a dataset to review data preparation and train a model.";
    const rejected = Array.isArray(dataset?.rejectedRows) ? dataset.rejectedRows : [];
    main.querySelector(".rejected-rows").innerHTML = rejected.length
      ? `<details><summary>Rejected rows (${rejected.length})</summary><ul>${rejected.map((row) => `<li>Row ${escapeHtml(row.rowNumber ?? row.row ?? "—")}: ${escapeHtml(row.reason || row.message || "Invalid data")}</li>`).join("")}</ul></details>`
      : "";
    main.querySelector(".retrain-button").disabled = !canManage || !dataset || !selectedModel;
  };
  displayDataset();
  const renderConfusion = () => {
    main.querySelector(".confusion-model-name").textContent = String(selectedModel?.name || "NO MODEL SELECTED").toUpperCase();
    const matrix = selectedModel?.confusionMatrix || modelData.confusionMatrix;
    const labels = matrix?.labels || [];
    const values = matrix?.values || matrix?.matrix || [];
    main.querySelector(".confusion-content").innerHTML = labels.length && values.length
      ? `<div class="confusion-matrix-scroll"><table class="confusion-matrix"><thead><tr><th>Actual / Predicted</th>${labels.map((label) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${values.map((row, index) => `<tr><th>${escapeHtml(labels[index] || `Class ${index + 1}`)}</th>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      : '<div class="empty-list-state">No confusion matrix is available for this model.</div>';
  };
  renderConfusion();

  main.querySelectorAll(".view-model").forEach((button) => button.addEventListener("click", () => {
    selectedModel = models.find((model) => model.id === button.dataset.model) || selectedModel;
    renderConfusion();
    void renderChart();
  }));
  main.querySelectorAll(".set-active-model").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await selectActiveModel(button.dataset.model);
      activeModel = button.dataset.model;
      setSharedData({ activeModel });
      await reload();
    } catch (error) {
      main.dispatchEvent(new CustomEvent("app:toast", { bubbles: true, detail: { message: error.message || "Could not select this model.", type: "error" } }));
      button.disabled = false;
    }
  }));
  datasetSelect.addEventListener("change", displayDataset);
  main.querySelector(".upload-dataset").addEventListener("click", () => openUploadModal(main, async (dataset) => {
    main.dispatchEvent(new CustomEvent("app:toast", { bubbles: true, detail: { message: `${dataset.fileName} uploaded successfully.`, type: "success" } }));
    await reload();
  }));

  const canvas = main.querySelector("canvas");
  async function renderChart() {
    const Chart = await loadChartJs();
    chartInstance?.destroy?.();
    const selectedMetric = metrics.find(([key]) => key === currentMetric)?.[1] ?? currentMetric;
    const summary = models.length
      ? models.map((model) => `${model.name}: ${percent(model.metrics?.[currentMetric])} ${selectedMetric}`).join("; ")
      : "No candidate models have been trained.";
    describeChart(canvas, `Compare model ${currentMetric} scores`, summary);
    chartInstance = new Chart(canvas, {
      type: "bar",
      data: { labels: models.map((model) => model.name), datasets: [{ label: selectedMetric, data: models.map((model) => Number(model.metrics?.[currentMetric]) || 0), backgroundColor: models.map((model) => model.id === activeModel ? chartColors.brandAccent : "rgba(35, 91, 77, 0.45)"), borderRadius: 4, borderSkipped: false, maxBarThickness: 42 }] },
      options: { ...chartBaseOptions, indexAxis: "y", plugins: { ...chartBaseOptions.plugins, legend: { display: false }, tooltip: { ...chartBaseOptions.plugins.tooltip, callbacks: { label: (item) => `${item.raw}%` } } }, scales: {
        x: { ...chartBaseOptions.scales.x, min: 0, max: 100, grid: { color: chartColors.grid }, ticks: { ...chartBaseOptions.scales.x.ticks, callback: (value) => `${value}%` } },
        y: { ...chartBaseOptions.scales.y, grid: { display: false } },
      } },
    });
    main._modelChart = chartInstance;
  }
  main.querySelector(".metric-chart-toolbar select").addEventListener("change", (event) => { currentMetric = event.target.value; void renderChart(); });
  main.querySelector(".retrain-button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const status = main.querySelector(".retrain-status");
    if (!selectedDataset || !selectedModel) return;
    button.disabled = true;
    status.hidden = false;
    status.textContent = "Retraining model…";
    try {
      let job = await retrainModel({ datasetId: selectedDataset.datasetId || selectedDataset.id, modelId: selectedModel.id });
      for (let attempt = 0; job?.status && !["completed", "failed", "error"].includes(String(job.status).toLowerCase()) && attempt < 30; attempt++) {
        status.textContent = "Training is running…";
        await wait(1000);
        job = await getRetrainJob(job.jobId || job.id);
      }
      if (String(job?.code || job?.error?.code || "").toUpperCase() === "DATASET_TOO_SMALL") {
        status.textContent = "A model cannot be trained yet";
        return;
      }
      if (["failed", "error"].includes(String(job?.status).toLowerCase())) throw new Error(job.message || "Model training failed.");
      status.textContent = "Training complete. Refreshing metrics…";
      await reload();
    } catch (error) {
      if (String(error.code || "").toUpperCase() === "DATASET_TOO_SMALL" || error.status === 422 && /dataset.*small|too few rows/i.test(error.message)) {
        status.textContent = "A model cannot be trained yet";
      } else {
        status.textContent = error.message || "Model training failed.";
      }
    } finally { button.disabled = !canManage || !selectedDataset || !selectedModel; }
  });
  void renderChart();
}

function openUploadModal(main, onUploaded) {
  const content = document.createElement("div");
  content.className = "dataset-upload-content";
  content.innerHTML = `<p class="upload-intro">Upload a CSV dataset to add records to the preparation workspace.</p><input class="sr-only" type="file" accept=".csv,text/csv" aria-label="Choose a CSV dataset"><div class="upload-dropzone" role="group" tabindex="0" aria-label="Choose a CSV file or drop it here"><span class="upload-icon">${iconSvg("file", 22)}</span><span class="upload-prompt"><b>Choose a CSV file or drop it here</b><small>.csv only · Maximum file size 10 MB</small></span><span class="upload-file-details" hidden><b class="upload-file-name"></b><small class="upload-file-size"></small><button type="button" class="upload-remove">Remove</button></span></div><div class="upload-validation" role="alert" hidden></div><div class="upload-progress-wrap" hidden><div class="upload-progress"><i></i></div><small>Uploading <span>0%</span></small></div>`;
  const footer = document.createElement("footer");
  footer.className = "dialog-actions upload-modal-footer";
  footer.innerHTML = `<button type="button" class="button button-secondary overlay-cancel">Cancel</button><button type="button" class="button button-primary upload-done" disabled>Upload dataset</button>`;
  const fileInput = content.querySelector("input");
  const dropzone = content.querySelector(".upload-dropzone");
  const error = content.querySelector(".upload-validation");
  const progress = content.querySelector(".upload-progress-wrap");
  const prompt = content.querySelector(".upload-prompt");
  const fileDetails = content.querySelector(".upload-file-details");
  const doneButton = footer.querySelector(".upload-done");
  let selectedFile = null;
  let uploading = false;
  const showError = (message) => { error.textContent = message; error.hidden = false; };
  const validate = (file) => {
    error.hidden = true;
    selectedFile = null;
    doneButton.disabled = true;
    prompt.hidden = false;
    fileDetails.hidden = true;
    progress.hidden = true;
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") || (file.type && !["text/csv", "application/vnd.ms-excel", "application/csv"].includes(file.type))) {
      showError("Choose a CSV file."); return;
    }
    if (file.size > 10 * 1024 * 1024) { showError("File must be 10 MB or smaller."); return; }
    selectedFile = file;
    content.querySelector(".upload-file-name").textContent = file.name;
    content.querySelector(".upload-file-size").textContent = file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      : file.size >= 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${file.size} B`;
    prompt.hidden = true;
    fileDetails.hidden = false;
    doneButton.disabled = false;
  };
  fileInput.addEventListener("change", () => validate(fileInput.files?.[0]));
  dropzone.addEventListener("click", (event) => { if (!event.target.closest(".upload-remove")) fileInput.click(); });
  dropzone.addEventListener("keydown", (event) => {
    if (event.target === dropzone && ["Enter", " "].includes(event.key)) { event.preventDefault(); fileInput.click(); }
  });
  dropzone.addEventListener("dragover", (event) => { event.preventDefault(); dropzone.classList.add("dragging"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
  dropzone.addEventListener("drop", (event) => { event.preventDefault(); dropzone.classList.remove("dragging"); validate(event.dataTransfer.files?.[0]); });
  content.querySelector(".upload-remove").addEventListener("click", () => { fileInput.value = ""; validate(null); });
  const close = openModal({ title: "Upload dataset", content, footer, canClose: () => !uploading });
  document.querySelector(".modal-panel")?.classList.add("dataset-upload-modal");
  footer.querySelector(".overlay-cancel").addEventListener("click", () => { if (uploading) return; });
  doneButton.addEventListener("click", async () => {
    if (!selectedFile || uploading) return;
    uploading = true;
    doneButton.disabled = true;
    fileInput.disabled = true;
    progress.hidden = false;
    error.hidden = true;
    const progressBar = progress.querySelector(".upload-progress i");
    const progressText = progress.querySelector("small span");
    try {
      const result = await uploadDataset(selectedFile, { onUploadProgress: ({ percent: value }) => {
        progressBar.style.width = `${value}%`;
        progressText.textContent = `${value}%`;
      } });
      progressBar.style.width = "100%";
      progressText.textContent = "100%";
      const summary = result.preparation || result.summary || {};
      const rejectedRows = result.rejectedRows || result.validation?.rejectedRows || [];
      const dataset = { ...result, preparation: summary, rejectedRows };
      await onUploaded(dataset);
      close();
    } catch (uploadError) {
      uploading = false;
      fileInput.disabled = false;
      doneButton.disabled = false;
      showError(uploadError.message || "The dataset could not be uploaded.");
    }
  });
  return close;
}
