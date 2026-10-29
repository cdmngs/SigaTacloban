import { api, unwrapResponse } from "./client.js";

let mockReports;

export async function listReports(options = {}) {
  const response = await api.get("/reports", {
    ...options,
    mockSample: "reports-list",
    mockTransform: (reports, meta) => {
      if (!mockReports) mockReports = reports;
      return { data: mockReports, meta: { ...meta, total: mockReports.length, page: 1, pageSize: mockReports.length } };
    },
  });
  const data = unwrapResponse(response);
  if (!mockReports) mockReports = data;
  return data;
}

export async function previewReport(settings, options = {}) {
  return unwrapResponse(await api.post("/reports/preview", settings, { ...options, mockSample: "reports-preview" }));
}

export async function createReport(settings, generatedBy, options = {}) {
  const response = await api.post("/reports", { settings }, {
    ...options,
    mockSample: "reports-create",
    mockTransform: (sample) => {
      const title = String(settings.title ?? "").trim() || "Tacloban City Fire Risk Assessment";
      const report = {
        ...sample,
        id: `report-${crypto.randomUUID()}`,
        title,
        fileName: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
        generatedBy,
        generatedAt: new Date().toISOString(),
        settings: { ...settings, sections: [...(settings.sections || [])] },
      };
      mockReports = [report, ...(mockReports || [])];
      return { data: report, meta: {} };
    },
  });
  const report = unwrapResponse(response);
  mockReports = [report, ...(mockReports || []).filter((item) => item.id !== report.id)];
  return report;
}

export async function downloadReport(id, options = {}) {
  return unwrapResponse(await api.get(`/reports/${encodeURIComponent(id)}/download`, {
    ...options,
    mockSample: "reports-download",
  }));
}

export async function deleteReport(id, options = {}) {
  await api.delete(`/reports/${encodeURIComponent(id)}`, {
    ...options,
    mockSample: "reports-delete",
    mockTransform: () => {
      mockReports = (mockReports || []).filter((report) => report.id !== id);
      return { data: null, meta: {} };
    },
  });
  mockReports = (mockReports || []).filter((report) => report.id !== id);
}

export function duplicateReportSettings(id) {
  const report = mockReports?.find((item) => item.id === id);
  return report ? { ...report.settings, sections: [...report.settings.sections] } : undefined;
}
