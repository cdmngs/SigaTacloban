import { api, unwrapResponse } from "./client.js";

export async function fetchTrends(period, options = {}) {
  const { areaId, ...requestOptions } = options;
  return unwrapResponse(await api.get("/trends", {
    ...requestOptions,
    query: { period, ...(areaId ? { areaId } : {}) },
    mockSample: "trends-summary",
  }));
}

export async function fetchTrendBarangays(period, limit = 5, options = {}) {
  const { areaId, ...requestOptions } = options;
  const rows = unwrapResponse(await api.get("/trends/barangays", {
    ...requestOptions,
    query: { period, limit, ...(areaId ? { areaId } : {}) },
    mockSample: "trends-barangays",
    mockTransform: (sample, meta) => {
      const selected = areaId ? sample.filter((row) => row.id === areaId) : sample;
      return { data: selected, meta: { ...meta, total: selected.length, page: 1, pageSize: limit } };
    },
  })) || [];
  return rows.map((row) => ({ ...row, score: row.score ?? row.riskScore }));
}

export async function exportTrends(period, options = {}) {
  const { areaId, ...requestOptions } = options;
  return unwrapResponse(await api.get("/trends/export.csv", {
    ...requestOptions,
    query: { period, ...(areaId ? { areaId } : {}) },
    mockSample: "trends-export",
  }));
}
