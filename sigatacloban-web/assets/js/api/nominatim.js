import { NOMINATIM_VIEWBOX } from "./config.js";
import { api, unwrapResponse } from "./client.js";

let nextSearchAt = 0;
const SEARCH_INTERVAL_MS = 1000;

function waitForSearchSlot(signal) {
  const delay = Math.max(0, nextSearchAt - Date.now());
  if (!delay) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(signal.reason || new DOMException("Request aborted.", "AbortError"));
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, delay);
    const abort = () => {
      window.clearTimeout(timer);
      reject(signal.reason || new DOMException("Request aborted.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function nominatimSearch(query, signal) {
  const term = String(query ?? "").trim();
  if (term.length < 2) return [];
  await waitForSearchSlot(signal);
  nextSearchAt = Date.now() + SEARCH_INTERVAL_MS;
  return unwrapResponse(await api.get("/geocoding/search", {
    signal,
    query: { q: term, viewbox: NOMINATIM_VIEWBOX, bounded: 1, limit: 6 },
    mockSample: "geocoding-search",
  }));
}

export async function reverseGeocode(lat, lng, options = {}) {
  return unwrapResponse(await api.get("/geocoding/reverse", {
    ...options,
    query: { lat, lng },
    mockSample: "geocoding-reverse",
  }));
}
