import { api, unwrapResponse } from "./client.js";

function uiArea(area) {
  if (!area) return area;
  const riskLevel = area.riskLevel || area.level;
  return {
    ...area,
    score: area.score ?? area.riskScore,
    level: String(area.level || riskLevel || "Low").toLowerCase().replace(/\s+/g, ""),
    center: Array.isArray(area.center) ? area.center : area.center ? [area.center.lat, area.center.lng] : undefined,
  };
}

export async function fetchRiskAreas(options = {}) {
  return (unwrapResponse(await api.get("/risk/areas", { ...options, mockSample: "risk-areas" })) || []).map(uiArea);
}

export async function fetchRiskForDay(day, options = {}) {
  return (unwrapResponse(await api.get(`/risk/forecast/${encodeURIComponent(day)}`, { ...options, mockSample: "risk-forecast" })) || []).map(uiArea);
}

export async function fetchCityRisk(options = {}) {
  return unwrapResponse(await api.get("/risk/city", { ...options, mockSample: "risk-city" }));
}

export async function fetchRiskHotspots(day, options = {}) {
  return unwrapResponse(await api.get("/risk/hotspots", { ...options, query: { day }, mockSample: "risk-hotspots" }));
}

export async function fetchRiskArea(id, day, options = {}) {
  return uiArea(unwrapResponse(await api.get(`/risk/areas/${encodeURIComponent(id)}`, { ...options, query: { day }, mockSample: "risk-area-detail" })));
}

export async function fetchMonthlyIncidents(year, options = {}) {
  return unwrapResponse(await api.get("/incidents/monthly", { ...options, query: { year }, mockSample: "incidents-monthly" }));
}
