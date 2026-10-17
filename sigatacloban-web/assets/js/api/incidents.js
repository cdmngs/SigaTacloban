import { USE_MOCKS } from "./config.js";
import { requestJson } from "./client.js";
import { mockDelay } from "./mockDelay.js";
export async function fetchIncidents() {
  if (USE_MOCKS) { await mockDelay(); return []; }
  return requestJson("/incidents");
}
