import { api, unwrapResponse } from "./client.js";
import { USE_MOCK } from "./config.js";

export const EMPTY_INCIDENT_FILTERS = Object.freeze({ search: "", barangay: "", from: "", to: "", fireClass: "", severity: "" });
let mockIncidents;

function uiIncident(incident) {
  if (!incident) return incident;
  const severity = String(incident.severity || incident.severityLabel || "Low");
  return {
    ...incident,
    class: incident.class || incident.fireClass,
    fireClass: incident.fireClass || incident.class,
    severityLabel: incident.severityLabel || severity,
    severity: severity.toLowerCase().replace(/\s+/g, ""),
  };
}

function apiIncident(payload) {
  const { class: legacyClass, severityLabel, ...fields } = payload;
  const rawSeverity = severityLabel || payload.severity;
  const severity = {
    low: "Low",
    moderate: "Moderate",
    high: "High",
    veryhigh: "Very High",
    "very high": "Very High",
  }[String(rawSeverity || "").toLowerCase()] || rawSeverity;
  const body = { ...fields };
  const fireClass = payload.fireClass || legacyClass;
  if (fireClass !== undefined) body.fireClass = fireClass;
  if (severity !== undefined) body.severity = severity;
  return body;
}

export function filterIncidents(records, filters = EMPTY_INCIDENT_FILTERS, page = 1, pageSize = 10, sort = { key: "date", direction: "desc" }) {
  const rows = [...records].filter((incident) => {
    const search = String(filters.search ?? "").trim().toLowerCase();
    if (search && !`${incident.id} ${incident.barangay} ${incident.fireClass} ${incident.cause}`.toLowerCase().includes(search)) return false;
    if (filters.barangay && incident.barangay !== filters.barangay) return false;
    if (filters.from && incident.date < filters.from) return false;
    if (filters.to && incident.date > filters.to) return false;
    if (filters.fireClass && incident.fireClass !== filters.fireClass) return false;
    if (filters.severity && incident.severityLabel !== filters.severity && incident.severity !== filters.severity.toLowerCase()) return false;
    return true;
  }).sort((left, right) => {
    const direction = sort.direction === "asc" ? 1 : -1;
    const first = left[sort.key] ?? (sort.key === "severity" ? left.severity : undefined);
    const second = right[sort.key] ?? (sort.key === "severity" ? right.severity : undefined);
    return typeof first === "number" && typeof second === "number"
      ? (first - second) * direction
      : String(first ?? "").localeCompare(String(second ?? "")) * direction;
  });
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  return { rows: rows.slice((safePage - 1) * safePageSize, safePage * safePageSize), total: rows.length, page: safePage, pageSize: safePageSize };
}

async function loadMockIncidents(signal) {
  if (!mockIncidents) mockIncidents = unwrapResponse(await api.get("/incidents", { mockSample: "incidents-list", signal }));
  return mockIncidents;
}

export async function fetchIncidents(options = {}) {
  const response = await api.get("/incidents", {
    ...options,
    mockListHandled: true,
    mockSample: "incidents-list",
    mockTransform: async (records) => {
      if (!mockIncidents) mockIncidents = records;
      return { data: mockIncidents, meta: { total: mockIncidents.length, page: 1, pageSize: mockIncidents.length } };
    },
  });
  return (unwrapResponse(response) || []).map(uiIncident);
}

export async function fetchIncidentOptions(options = {}) {
  return unwrapResponse(await api.get("/incidents/options", {
    ...options,
    mockSample: "incidents-options",
  }));
}

export async function listIncidents(filters = EMPTY_INCIDENT_FILTERS, page = 1, pageSize = 10, sort = { key: "date", direction: "desc" }, options = {}) {
  const query = { ...filters, page, pageSize, sort: sort.key, direction: sort.direction };
  const response = await api.get("/incidents", {
    ...options,
    query,
    mockListHandled: true,
    mockSample: "incidents-list",
    mockTransform: (records) => {
      if (!mockIncidents) mockIncidents = records;
      const result = filterIncidents(mockIncidents, filters, page, pageSize, sort);
      return { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } };
    },
  });
  const data = unwrapResponse(response) || [];
  return {
    rows: (Array.isArray(data) ? data : data.rows || []).map(uiIncident),
    total: response.meta?.total ?? data.total ?? data.length ?? 0,
    page: response.meta?.page ?? data.page ?? page,
    pageSize: response.meta?.pageSize ?? data.pageSize ?? pageSize,
  };
}

export async function getIncident(id, options = {}) {
  const response = await api.get(`/incidents/${encodeURIComponent(id)}`, {
    ...options,
    mockSample: "incidents-detail",
    mockTransform: () => ({ data: mockIncidents?.find((incident) => incident.id === id) || null, meta: {} }),
  });
  return uiIncident(unwrapResponse(response));
}

export async function createIncident(payload, options = {}) {
  if (USE_MOCK) await loadMockIncidents(options.signal);
  const body = apiIncident(payload);
  const response = await api.post("/incidents", body, {
    ...options,
    mockSample: "incidents-create",
    mockTransform: (sample) => {
      const record = { ...sample, ...body, id: `INC-MOCK-${Date.now()}` };
      mockIncidents = [record, ...(mockIncidents || [])];
      return { data: record, meta: {} };
    },
  });
  return uiIncident(unwrapResponse(response));
}

export async function updateIncident(id, payload, options = {}) {
  if (USE_MOCK) await loadMockIncidents(options.signal);
  const body = apiIncident(payload);
  const response = await api.patch(`/incidents/${encodeURIComponent(id)}`, body, {
    ...options,
    mockSample: "incidents-update",
    mockTransform: (sample) => {
    mockIncidents = (mockIncidents || []).map((incident) => incident.id === id ? { ...incident, ...body } : incident);
    return { data: mockIncidents.find((incident) => incident.id === id) || { ...sample, ...body, id }, meta: {} };
    },
  });
  return uiIncident(unwrapResponse(response));
}

export async function deleteIncident(id, options = {}) {
  if (USE_MOCK) await loadMockIncidents(options.signal);
  await api.delete(`/incidents/${encodeURIComponent(id)}`, {
    ...options,
    mockSample: "incidents-delete",
    mockTransform: () => {
      mockIncidents = (mockIncidents || []).filter((incident) => incident.id !== id);
      return { data: null, meta: {} };
    },
  });
}

export async function exportIncidents(filters = {}, options = {}) {
  const response = await api.get("/incidents/export.csv", { ...options, query: filters, mockSample: "incidents-export" });
  return unwrapResponse(response);
}

export async function fetchMonthlyIncidents(year, options = {}) {
  return unwrapResponse(await api.get("/incidents/monthly", { ...options, query: { year }, mockSample: "incidents-monthly" }));
}
