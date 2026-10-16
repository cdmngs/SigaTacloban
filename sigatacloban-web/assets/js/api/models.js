import { USE_MOCKS } from "./config.js";
import { requestJson } from "./client.js";
import { mockDelay } from "./mockDelay.js";
const EMPTY_MODEL_EVALUATION = Object.freeze({ models: [], fileName: "", uploadedRecords: 0, steps: [] });
export async function fetchModelEvaluation() {
  if (USE_MOCKS) { await mockDelay(); return { ...EMPTY_MODEL_EVALUATION, models: [], steps: [] }; }
  return requestJson("/models/evaluation");
}
