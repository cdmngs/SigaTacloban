import { api, unwrapResponse } from "./client.js";
import { simulateRisk } from "../utils/simulate-risk.js";
import { riskLabelForLevel } from "../utils/risk.js";
export { simulateRisk, isScreenshotWhatIfScenario } from "../utils/simulate-risk.js";

let mockScenarios;
let mockAreas;

export async function fetchWhatIfAreas(options = {}) {
  return unwrapResponse(await api.get("/whatif/areas", {
    ...options,
    mockSample: "whatif-areas",
    mockTransform: (areas, meta) => {
      mockAreas = areas;
      return { data: areas, meta };
    },
  }));
}

export async function simulateWhatIf(payload, options = {}) {
  return unwrapResponse(await api.post("/whatif/simulations", payload, {
    ...options,
    mockSample: "whatif-simulation",
    mockTransform: (sample) => {
      const area = mockAreas?.find((item) => item.id === payload.areaId);
      if (!area) throw new Error(`No mock What-If data is available for area "${payload.areaId}".`);
      const result = simulateRisk(area, {
        temperatureC: payload.temperatureC,
        humidityPercent: payload.humidityPercent,
        rainfallMm: payload.rainfallMm,
        windKph: payload.windKph,
      });
      return {
        data: {
          ...sample,
          riskScore: result.score,
          riskLevel: riskLabelForLevel(result.level),
          delta: result.delta,
          factors: result.factors,
        },
        meta: {},
      };
    },
  }));
}

export async function listScenarios(areaId, options = {}) {
  const response = await api.get("/whatif/scenarios", {
    ...options,
    query: { areaId },
    mockSample: "whatif-scenarios-list",
    mockTransform: (sample, meta) => {
      if (!mockScenarios) mockScenarios = sample;
      const rows = mockScenarios.filter((scenario) => !areaId || scenario.areaId === areaId);
      return { data: rows, meta: { ...meta, total: rows.length, page: 1, pageSize: rows.length } };
    },
  });
  return unwrapResponse(response);
}

export async function saveScenario(payload, options = {}) {
  const response = await api.post("/whatif/scenarios", payload, {
    ...options,
    mockSample: "whatif-scenarios-create",
    mockTransform: (sample) => {
      const scenario = { ...sample, ...payload, id: `scenario-${crypto.randomUUID()}`, savedAt: new Date().toISOString() };
      mockScenarios = [scenario, ...(mockScenarios || [])];
      return { data: scenario, meta: {} };
    },
  });
  return unwrapResponse(response);
}

export async function deleteScenario(id, options = {}) {
  await api.delete(`/whatif/scenarios/${encodeURIComponent(id)}`, {
    ...options,
    mockSample: "whatif-scenarios-delete",
    mockTransform: () => {
      mockScenarios = (mockScenarios || []).filter((scenario) => scenario.id !== id);
      return { data: null, meta: {} };
    },
  });
}
