import { api, unwrapResponse } from "./client.js";

function uiCoverage(coverage) {
  if (!coverage) return coverage;
  return {
    ...coverage,
    underserved: (coverage.underserved || []).map((item) => ({
      ...item,
      area: item.area ? {
        ...item.area,
        level: String(item.area.level || item.area.riskLevel || "Low").toLowerCase().replace(/\s+/g, ""),
      } : item.area,
    })),
  };
}

export async function getCoverage(options = {}) {
  return uiCoverage(unwrapResponse(await api.get("/coverage", { ...options, mockSample: "coverage-summary" })));
}

export async function getCoverageRings(minutes = [5, 10, 15], options = {}) {
  return unwrapResponse(await api.get("/coverage/rings", {
    ...options,
    query: { minutes: minutes.join(",") },
    mockSample: "coverage-rings",
  }));
}

export async function planCoverageStation(lat, lng, options = {}) {
  return unwrapResponse(await api.post("/coverage/stations/plan", { lat, lng }, { ...options, mockSample: "coverage-plan" }));
}
