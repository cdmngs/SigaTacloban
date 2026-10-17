import { USE_MOCKS } from "./config.js";
import { requestJson } from "./client.js";
import { mockDelay } from "./mockDelay.js";
export async function fetchRiskAreas() {
  if (USE_MOCKS) { await mockDelay(); return []; }
  return requestJson("/risk/areas");
}
export async function fetchRiskForDay(day) {
  if (USE_MOCKS) { void day; await mockDelay(); return []; }
  return requestJson(`/risk/forecast/${encodeURIComponent(day)}`);
}
export async function fetchMonthlyIncidents() {
  if (USE_MOCKS) { await mockDelay(); return []; }
  return requestJson("/incidents/monthly");
}
