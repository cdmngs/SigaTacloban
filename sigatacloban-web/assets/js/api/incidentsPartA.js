import { USE_MOCKS } from "./config.js";
import { requestJson } from "./client.js";
import { mockDelay } from "./mockDelay.js";

export const EMPTY_INCIDENT_FILTERS = Object.freeze({ search: "", barangay: "", from: "", to: "", fireClass: "", severity: "" });
let incidents = [];
export function filterIncidents(records, filters = EMPTY_INCIDENT_FILTERS, page = 1, pageSize = 10, sort = { key: "date", direction: "desc" }) {
  const rows = [...records].filter((incident) => {
    const search = String(filters.search ?? "").trim().toLowerCase();
    if (search && !`${incident.id} ${incident.barangay} ${incident.fireClass} ${incident.cause}`.toLowerCase().includes(search)) return false;
    if (filters.barangay && incident.barangay !== filters.barangay) return false;
    if (filters.from && incident.date < filters.from) return false;
    if (filters.to && incident.date > filters.to) return false;
    if (filters.fireClass && incident.fireClass !== filters.fireClass) return false;
    if (filters.severity && incident.severityLabel !== filters.severity) return false;
    return true;
  }).sort((left, right) => {
    const direction = sort.direction === "asc" ? 1 : -1;
    const first = left[sort.key];
    const second = right[sort.key];
    return typeof first === "number" && typeof second === "number"
      ? (first - second) * direction
      : String(first ?? "").localeCompare(String(second ?? "")) * direction;
  });
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  return { rows: rows.slice((safePage - 1) * safePageSize, safePage * safePageSize), total: rows.length, page: safePage, pageSize: safePageSize };
}
export async function listIncidents(filters = EMPTY_INCIDENT_FILTERS, page = 1, pageSize = 10, sort = { key: "date", direction: "desc" }) {
  if (!USE_MOCKS) {
    const params = new URLSearchParams({ ...filters, page: String(page), pageSize: String(pageSize), sort: sort.key, direction: sort.direction });
    return requestJson(`/incidents?${params}`);
  }
  await mockDelay();
  return filterIncidents(incidents, filters, page, pageSize, sort);
}
export async function getIncident(id) {
  if (!USE_MOCKS) return requestJson(`/incidents/${encodeURIComponent(id)}`);
  await mockDelay();
  return incidents.find((incident) => incident.id === id);
}
export async function createIncident(data) {
  if (!USE_MOCKS) return requestJson("/incidents", { method: "POST", body: JSON.stringify(data) });
  await mockDelay();
  const severity = { Low: "low", Moderate: "moderate", High: "high", "Very High": "veryhigh" }[data.severityLabel];
  const record = { ...data, id: `FS-${new Date(data.date).getFullYear()}-${String(incidents.length + 1).padStart(3, "0")}`, areaId: "", severity, class: data.fireClass, status: "Open" };
  incidents = [record, ...incidents];
  return record;
}
export async function updateIncident(id, data) {
  if (!USE_MOCKS) return requestJson(`/incidents/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) });
  await mockDelay();
  incidents = incidents.map((incident) => incident.id === id ? { ...incident, ...data } : incident);
}
export async function deleteIncident(id) {
  if (!USE_MOCKS) return requestJson(`/incidents/${encodeURIComponent(id)}`, { method: "DELETE" });
  await mockDelay();
  incidents = incidents.filter((incident) => incident.id !== id);
}
