import { listReports, createReport, deleteReport, duplicateReportSettings, previewReport, downloadReport } from "../api/reports.js";
import { fetchRiskAreas } from "../api/risk.js";
import { fetchWeatherAnalysis } from "../api/weatherAnalysis.js";
import { getCoverage } from "../api/coverage.js";
import { listIncidents } from "../api/incidents.js";
import { openOverlay } from "../ui/overlays.js";
import { createEmptyState } from "../ui/empty-state.js";
import { loadData } from "../core/data-state.js";
import { escapeHtml } from "../utils/dom.js";
import { iconSvg } from "../ui/icons.js";
import { formatNumber, formatValue, formatDateTime } from "../utils/format.js";

const styles = ["phase4-pages.css", "reports.css"];
const sections = [
  ["executiveSummary", "Executive summary"], ["cityRisk", "City risk overview"], ["highRiskAreas", "Highest-risk barangays"],
  ["weather", "Weather analysis"], ["coverage", "Station coverage"], ["incidentHistory", "Incident history"],
  ["trends", "Trends"], ["riskMap", "Risk map snapshot"], ["mlSummary", "ML model summary"], ["whatIf", "What-If scenarios"],
];
const defaultSettings = {
  title: "Tacloban City Fire Risk Assessment",
  dateStart: "2024-09-01",
  dateEnd: "2024-09-30",
  areaId: "",
  sections: ["executiveSummary", "cityRisk", "highRiskAreas", "weather", "coverage", "incidentHistory"],
};
const esc = escapeHtml;

function ensureStyles() {
  for (const file of styles) {
    const id = `phase4-${file}`;
    if (document.getElementById(id)) continue;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet"; link.href = `assets/css/${file}`;
    document.head.append(link);
  }
}

export async function mount(main, user) {
  ensureStyles();
  main.innerHTML = '<div class="phase4-page phase4-loading"><div class="skeleton phase4-title-skeleton"></div><div class="reports-skeleton"><div class="skeleton"></div><div class="skeleton"></div></div><div class="skeleton reports-past-skeleton"></div></div>';
  const loader = loadData(async (signal) => {
    const [past, risk, weather, coverage, incidents] = await Promise.all([
      listReports({ signal }),
      fetchRiskAreas({ signal }),
      fetchWeatherAnalysis({ signal }),
      getCoverage({ signal }),
      listIncidents({ search: "", barangay: "", from: "", to: "", fireClass: "", severity: "" }, 1, 10, { key: "date", direction: "desc" }, { signal }),
    ]);
    return { past, risk, weather, coverage, incidents };
  }, [], {
    container: main,
    isEmpty: () => false,
    errorTitle: "Report data could not be loaded",
    success(_container, data) { render(main, user, data); },
  });
  await loader.load();
}

function render(main, user, data) {
  let settings = { ...defaultSettings, sections: [...defaultSettings.sections], areaId: new URLSearchParams(location.search).get("area") || "" };
  let selectedDateRange = "custom";
  let menuReport = null;
  let previewTimer = null;
  let previewLoader = null;
  let previewRequest = 0;
  let generating = false;
  let progress = 0;
  const selectedArea = () => data.risk.find((item) => item.id === settings.areaId);
  const score = () => selectedArea()?.riskScore ?? selectedArea()?.score;
  const level = (value) => Number(value) >= 80 ? "Very High" : Number(value) >= 60 ? "High" : Number(value) >= 40 ? "Moderate" : "Low";

  const datePreset = (value) => {
    selectedDateRange = value;
    const end = new Date();
    let start = new Date(end);
    if (value === "sept2024") {
      start = new Date("2024-09-01T12:00:00");
      end.setFullYear(2024, 8, 30);
    } else if (value === "ytd") start = new Date(end.getFullYear(), 0, 1);
    else start.setDate(end.getDate() - 30);
    settings.dateStart = start.toISOString().slice(0, 10);
    settings.dateEnd = end.toISOString().slice(0, 10);
  };

  const schedulePreview = (immediate = false) => {
    clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      const requestId = ++previewRequest;
      previewLoader?.destroy();
      const container = main.querySelector(".report-preview-data");
      if (!container) return;
      previewLoader = loadData((payload, signal) => previewReport(payload, { signal }), [structuredClone(settings)], {
        container,
        loading(node) { node.innerHTML = '<div class="preview-loading"><div class="skeleton"></div><div class="skeleton"></div></div>'; },
        errorTitle: "Preview could not be updated",
        errorMessage: "Retry to request the report preview again.",
        success(node, response) {
          if (requestId !== previewRequest) return;
          renderPreviewData(node, response, settings.sections);
        },
      });
      void previewLoader.load();
    }, immediate ? 0 : 300);
  };

  const paint = () => {
    previewLoader?.destroy();
    const month = settings.dateStart && settings.dateEnd
      ? `${new Date(`${settings.dateStart}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })} – ${new Date(`${settings.dateEnd}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
      : "Date range required";
    const area = selectedArea();
    const reportRows = Array.isArray(data.past) ? data.past : [];
    main.innerHTML = `<div class="phase4-page reports-page"><header class="phase4-heading"><div><span class="eyebrow">DECISION SUPPORT</span><h1>Reports</h1><p>Build and export official fire risk intelligence reports.</p></div><button class="button button-primary new-report" type="button">${iconSvg("plus", 14)}New report</button></header><div class="report-workspace">
      <section class="card report-builder-card"><span class="eyebrow">CONFIGURE YOUR DOCUMENT</span><h2>Report builder</h2><label class="builder-label">Report title<input aria-label="Report title" required value="${esc(settings.title)}"></label><small class="report-title-error field-error" hidden></small>
       <div class="builder-select-row"><label class="builder-label">Date range<select aria-label="Date range" class="date-range"><option value="custom" ${selectedDateRange === "custom" ? "selected" : ""}>Custom range</option><option value="last30" ${selectedDateRange === "last30" ? "selected" : ""}>Last 30 days</option><option value="sept2024" ${selectedDateRange === "sept2024" ? "selected" : ""}>01 Sep – 30 Sep 2024</option><option value="ytd" ${selectedDateRange === "ytd" ? "selected" : ""}>Year to date</option></select></label><label class="builder-label">Area<select aria-label="Report area" class="report-area"><option value="">All barangays</option>${data.risk.map((item) => `<option value="${esc(item.id)}" ${item.id === settings.areaId ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></label></div>
       <span class="builder-section-label">Include sections</span><div class="report-section-checks">${sections.map(([key, label]) => `<label><input type="checkbox" data-section="${key}" ${settings.sections.includes(key) ? "checked" : ""}><span class="custom-check">✓</span>${label}</label>`).join("")}</div><small class="report-sections-error field-error" hidden>Select at least one section.</small><button class="button button-primary update-preview-button" type="button">${iconSvg("refresh", 14)}Update preview</button></section>
      <section class="report-preview-panel" aria-label="Live report preview"><header><div><b>Live preview</b><small>${1 + settings.sections.length} pages · A4</small></div><button class="button button-primary export-pdf" type="button" ${generating ? "disabled" : ""}>${generating ? `Generating ${progress}%…` : "Generate PDF"}</button></header>${generating ? `<div class="export-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>` : ""}<div class="report-pages-scroll"><article class="report-page report-cover-page"><div class="report-paper-brand"><span class="report-logo"><img src="assets/img/logo.png" alt="SigaTacloban" width="34"></span><strong>BUREAU OF FIRE PROTECTION</strong></div><div class="report-cover-content"><span class="report-eyebrow">MONTHLY INTELLIGENCE REPORT</span><h2 class="cover-title">${esc(settings.title)}</h2><p>${esc(month)}</p><div class="cover-risk-box${area ? "" : " cover-risk-no-data"}">${area ? `<strong>${esc(formatNumber(score()))}<small>/100</small></strong><span><b>${esc(level(score()))} city risk</b><small>${esc(area.name)}</small></span>` : '<span><b class="cover-risk-neutral-chip">No data</b></span>'}</div></div><footer>Prepared for BFP Tacloban City - SigaTacloban Decision Support</footer></article><div class="report-preview-data"></div></div></section></div>
      <section class="card past-reports-card"><span class="eyebrow">RECENTLY GENERATED</span><h2>Past reports</h2><div class="past-report-list">${reportRows.length ? reportRows.map((report) => `<article class="past-report-row" data-report="${esc(report.id)}"><span>${iconSvg("file", 15)}</span><div><b>${esc(report.title)}</b><small>PDF · ${esc(formatValue(report.sizeLabel))} · Generated by ${esc(formatValue(report.generatedBy))}</small></div><time>${esc(formatValue(report.generatedAt ? new Date(report.generatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"))}</time><button type="button" aria-label="Download ${esc(report.title)}" data-download="${esc(report.id)}">${iconSvg("download", 13)}</button><div class="past-report-menu"><button type="button" aria-label="More actions for ${esc(report.title)}" data-menu="${esc(report.id)}">⋯</button>${menuReport === report.id ? `<div><button type="button" data-duplicate="${esc(report.id)}">Duplicate settings</button><button type="button" data-delete="${esc(report.id)}">Delete</button></div>` : ""}</div></article>`).join("") : '<p class="empty-list-state">No past reports yet.</p>'}</div></section></div>`;

    const titleInput = main.querySelector('[aria-label="Report title"]');
    titleInput.addEventListener("input", () => {
      settings.title = titleInput.value;
      main.querySelector(".cover-title").textContent = settings.title || "Untitled report";
      schedulePreview();
    });
    main.querySelector(".new-report").addEventListener("click", () => {
      settings = { ...defaultSettings, sections: [...defaultSettings.sections], areaId: new URLSearchParams(location.search).get("area") || "" };
      selectedDateRange = "custom";
      paint();
    });
    main.querySelector(".report-area").addEventListener("change", (event) => {
      settings.areaId = event.target.value;
      paint();
    });
    main.querySelector(".date-range").addEventListener("change", (event) => {
      if (event.target.value !== "custom") datePreset(event.target.value);
      paint();
    });
    main.querySelectorAll("[data-section]").forEach((input) => input.addEventListener("change", () => {
      settings.sections = input.checked
        ? [...new Set([...settings.sections, input.dataset.section])]
        : settings.sections.filter((key) => key !== input.dataset.section);
      paint();
    }));
    main.querySelector(".update-preview-button").addEventListener("click", () => schedulePreview(true));
    main.querySelector(".export-pdf").addEventListener("click", () => { void generate(main, user, data, settings, paint, setProgress); });
    main.querySelectorAll("[data-menu]").forEach((button) => button.addEventListener("click", () => {
      menuReport = menuReport === button.dataset.menu ? null : button.dataset.menu;
      paint();
    }));
    main.querySelectorAll("[data-duplicate]").forEach((button) => button.addEventListener("click", () => {
      const report = reportRows.find((item) => item.id === button.dataset.duplicate);
      const saved = duplicateReportSettings(button.dataset.duplicate) || report?.settings;
      if (saved) {
        settings = { ...saved, sections: [...(saved.sections || [])] };
        menuReport = null;
        paint();
      }
    }));
    main.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
      const report = reportRows.find((item) => item.id === button.dataset.delete);
      if (report) confirmDelete(main, data, report, () => { menuReport = null; paint(); });
    }));
    main.querySelectorAll("[data-download]").forEach((button) => button.addEventListener("click", () => {
      void downloadPast(main, reportRows.find((item) => item.id === button.dataset.download));
    }));
    schedulePreview();
  };

  const setProgress = (value) => {
    progress = value;
    let progressElement = main.querySelector(".export-progress");
    if (!progressElement) {
      progressElement = document.createElement("div");
      progressElement.className = "export-progress";
      progressElement.setAttribute("role", "progressbar");
      progressElement.setAttribute("aria-valuemin", "0");
      progressElement.setAttribute("aria-valuemax", "100");
      progressElement.innerHTML = "<span></span>";
      main.querySelector(".report-preview-panel header")?.after(progressElement);
    }
    progressElement.setAttribute("aria-valuenow", String(value));
    const bar = progressElement.querySelector("span");
    const button = main.querySelector(".export-pdf");
    if (bar) bar.style.width = `${value}%`;
    if (button) button.textContent = `Generating ${value}%…`;
  };
  paint();
}

function renderPreviewData(container, response, requestedSections) {
  const rows = Array.isArray(response?.sections) ? response.sections : [];
  const byKey = new Map(rows.map((item) => [item.key, item]));
  container.replaceChildren();
  for (const key of requestedSections) {
    const metadata = sections.find(([sectionKey]) => sectionKey === key);
    const preview = byKey.get(key);
    const article = document.createElement("article");
    article.className = "report-page report-section-page";
    article.innerHTML = `<header class="report-paper-brand"><span class="report-logo"><img src="assets/img/logo.png" alt="SigaTacloban" width="28"></span><strong>BUREAU OF FIRE PROTECTION</strong></header><h2></h2><div class="report-preview-section-content"></div><footer>Risk estimates, not exact predictions of future fires.</footer>`;
    article.querySelector("h2").textContent = formatValue(preview?.title || metadata?.[1] || key);
    const content = article.querySelector(".report-preview-section-content");
    const value = preview?.content;
    if (value === null || value === undefined) {
      content.append(createEmptyState("Preview data unavailable", "The preview API did not return this section yet.", "info"));
    } else if (typeof value === "string" || typeof value === "number") {
      const paragraph = document.createElement("p");
      paragraph.textContent = String(value);
      content.append(paragraph);
    } else {
      const list = document.createElement("dl");
      for (const [label, datum] of Object.entries(value)) {
        const term = document.createElement("dt"); term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = typeof datum === "object" ? JSON.stringify(datum) : formatValue(datum);
        list.append(term, description);
      }
      content.append(list);
    }
    container.append(article);
  }
  if (!requestedSections.length) container.append(createEmptyState("No sections selected", "Choose at least one report section to preview.", "info"));
}

async function generate(main, user, data, settings, repaint, setProgress) {
  const titleError = main.querySelector(".report-title-error");
  const sectionsError = main.querySelector(".report-sections-error");
  const titleInput = main.querySelector('[aria-label="Report title"]');
  titleError.hidden = true;
  sectionsError.hidden = true;
  if (!settings.title.trim()) {
    titleError.textContent = "Enter a report title.";
    titleError.hidden = false;
    titleInput.setAttribute("aria-invalid", "true");
    titleInput.focus();
    return;
  }
  if (!settings.dateStart || !settings.dateEnd || settings.dateStart > settings.dateEnd) {
    titleError.textContent = "Select a valid report date range.";
    titleError.hidden = false;
    return;
  }
  if (!settings.sections.length) {
    sectionsError.hidden = false;
    return;
  }
  let progress = 10;
  setProgress(progress);
  const progressTimer = window.setInterval(() => {
    progress = Math.min(80, progress + 7);
    setProgress(progress);
  }, 300);
  main.querySelector(".export-pdf").disabled = true;
  try {
    const report = await createReport({ ...settings, sections: [...settings.sections] }, user?.name ?? "BFP User");
    progress = 85; setProgress(progress);
    data.past = [report, ...(data.past || []).filter((item) => item.id !== report.id)];
    repaint();
    main.querySelector(".export-pdf").disabled = true;
    setProgress(progress);
    try {
      await downloadPast(main, report);
    } catch (downloadError) {
      main.dispatchEvent(new CustomEvent("app:toast", { bubbles: true, detail: { message: `Report generated and saved, but download failed: ${downloadError.message}`, type: "error" } }));
      return;
    }
    setProgress(100);
    main.dispatchEvent(new CustomEvent("app:toast", { bubbles: true, detail: { message: "Report generated, added to history and downloaded.", type: "success" } }));
  } catch (error) {
    main.dispatchEvent(new CustomEvent("app:toast", { bubbles: true, detail: { message: error.message || "Report generation failed.", type: "error" } }));
  } finally {
    window.clearInterval(progressTimer);
    const button = main.querySelector(".export-pdf");
    if (button) {
      button.disabled = false;
      button.textContent = "Generate PDF";
    }
    main.querySelector(".export-progress")?.remove();
  }
}

async function downloadPast(main, report) {
  if (!report?.id) return;
  try {
    const result = await downloadReport(report.id);
    const file = result?.data || result;
    if (file?.url || file?.downloadUrl) {
      const anchor = document.createElement("a");
      anchor.href = file.url || file.downloadUrl;
      anchor.download = file.fileName || report.fileName || `${report.id}.pdf`;
      anchor.target = "_blank";
      anchor.rel = "noopener";
      anchor.click();
      return;
    }
    if (typeof file?.contentBase64 !== "string") throw new Error("The report download response did not contain a file.");
    const binary = atob(file.contentBase64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const blob = new Blob([bytes], { type: file.contentType || "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.fileName || report.fileName || `${report.id}.pdf`;
    anchor.hidden = true;
    document.body.append(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    main.dispatchEvent(new CustomEvent("app:toast", { bubbles: true, detail: { message: error.message || "PDF download failed.", type: "error" } }));
    throw error;
  }
}

function confirmDelete(main, data, report, after) {
  const content = document.createElement("p");
  content.textContent = `Delete ${report.title} from the list?`;
  openOverlay({
    title: "Delete past report?",
    content,
    kind: "confirm",
    confirmLabel: "Delete report",
    onConfirm: async () => {
      await deleteReport(report.id);
      data.past = data.past.filter((item) => item.id !== report.id);
      after();
      main.dispatchEvent(new CustomEvent("app:toast", { bubbles: true, detail: { message: "Past report deleted.", type: "success" } }));
    },
  });
}
