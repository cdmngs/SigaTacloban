import { api, unwrapResponse } from "./client.js";

export async function fetchDashboardSummary(options = {}) {
  return unwrapResponse(await api.get("/dashboard/summary", { ...options, mockSample: "dashboard-summary" }));
}
