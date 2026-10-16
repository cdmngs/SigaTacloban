import { USE_MOCKS } from "./config.js";
import { requestJson } from "./client.js";
import { mockDelay } from "./mockDelay.js";

let reports = [];
export async function listReports() {
  if (USE_MOCKS) { await mockDelay(); return reports.map((report) => ({ ...report, settings: { ...report.settings, sections: [...report.settings.sections] } })); }
  return requestJson("/reports");
}
export async function createReport(settings, generatedBy) {
  if (!USE_MOCKS) return requestJson("/reports", { method: "POST", body: JSON.stringify({ settings, generatedBy }) });
  await mockDelay();
  const title = String(settings.title ?? "").trim() || "Tacloban City Fire Risk Assessment";
  const report = {
    id: `report-${crypto.randomUUID()}`, title, fileName: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
    sizeLabel: "—", generatedBy, generatedAt: new Date().toISOString(),
    settings: { ...settings, sections: [...(settings.sections || [])] },
  };
  reports = [report, ...reports];
  return report;
}
export async function deleteReport(id) {
  if (!USE_MOCKS) return requestJson(`/reports/${encodeURIComponent(id)}`, { method: "DELETE" });
  await mockDelay();
  reports = reports.filter((report) => report.id !== id);
}
export function duplicateReportSettings(id) {
  const report = reports.find((item) => item.id === id);
  return report ? { ...report.settings, sections: [...report.settings.sections] } : undefined;
}
