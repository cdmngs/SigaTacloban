import { USE_MOCKS } from "./config.js";
import { requestJson } from "./client.js";
import { mockDelay } from "./mockDelay.js";
export { simulateRisk, isScreenshotWhatIfScenario } from "../utils/simulate-risk.js";
export async function fetchWhatIfAreas() {
  if (USE_MOCKS) { await mockDelay(); return []; }
  return requestJson("/whatif/areas");
}
