import { USE_MOCKS } from "./config.js";
import { requestJson } from "./client.js";
import { mockDelay } from "./mockDelay.js";

const EMPTY_COVERAGE = Object.freeze({ score: 0, changePercent: 0, stations: [], underserved: [] });
export async function getCoverage() {
  if (USE_MOCKS) { await mockDelay(); return { ...EMPTY_COVERAGE, stations: [], underserved: [] }; }
  return requestJson("/coverage");
}
export async function planCoverageStation(lat, lng) {
  if (USE_MOCKS) { await mockDelay(); return { id: `plan-${Date.now()}`, lat, lng, beforeScore: 0, afterScore: 0 }; }
  return requestJson("/coverage/stations/plan", { method: "POST", body: JSON.stringify({ lat, lng }) });
}
