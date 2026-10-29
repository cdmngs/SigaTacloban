import { api, unwrapResponse } from "./client.js";

export async function fetchStations(options = {}) {
  return unwrapResponse(await api.get("/stations", { ...options, mockSample: "stations-list" }));
}

export async function createStation(payload, options = {}) {
  return unwrapResponse(await api.post("/stations", payload, { ...options, mockSample: "stations-create" }));
}

export async function updateStation(id, payload, options = {}) {
  return unwrapResponse(await api.patch(`/stations/${encodeURIComponent(id)}`, payload, { ...options, mockSample: "stations-update" }));
}
