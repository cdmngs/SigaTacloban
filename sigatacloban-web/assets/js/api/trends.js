import { USE_MOCKS } from "./config.js";
import { requestJson } from "./client.js";
import { mockDelay } from "./mockDelay.js";
const EMPTY_TRENDS = {
  period: "12m",
  kpis: { incidentsYtd: 0, incidentsChangePercent: 0, averageRisk: 0, averageRiskChangePercent: 0, peakMonth: "—", peakMonthIncidents: 0, forecastTrend: "—", forecastChangePercent: 0 },
  points: [],
};
export async function fetchTrends(period) {
  if (USE_MOCKS) { await mockDelay(); return { ...EMPTY_TRENDS, period, kpis: { ...EMPTY_TRENDS.kpis }, points: [] }; }
  return requestJson(`/trends?period=${encodeURIComponent(period)}`);
}
