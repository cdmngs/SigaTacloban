import { API_BASE_URL, READ_CACHE_TTL_MS, REQUEST_TIMEOUT_MS, USE_MOCK } from "./config.js";
import { getSession, saveSessionTokens, signOut } from "../core/auth.js";
import { mockDelay } from "./mockDelay.js";
import { validateResponse } from "./validate.js";

export class ApiError extends Error {
  constructor({ code = "API_ERROR", message = "The request could not be completed.", status = 0, details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const responseCache = new Map();
const sampleCache = new Map();
const normalizeApiError = (error, status = 0) => {
  if (error instanceof ApiError) return error;
  if (error?.name === "TimeoutError") {
    return new ApiError({ code: "REQUEST_TIMEOUT", message: "The request timed out. Please try again.", status, details: null });
  }
  if (error?.name === "AbortError") {
    return new ApiError({ code: "REQUEST_ABORTED", message: "The request was cancelled.", status, details: null });
  }
  return new ApiError({
    code: error?.code || "NETWORK_ERROR",
    message: error?.message || "Network error. Check your connection and retry.",
    status: error?.status ?? status,
    details: error?.details ?? null,
  });
};

const envelope = (value) => value && typeof value === "object" && Object.hasOwn(value, "data") && Object.hasOwn(value, "meta")
  ? value
  : { data: value, meta: {} };

export function clearApiCache() {
  responseCache.clear();
}

function applyMockListQuery(response, query = {}) {
  if (!Array.isArray(response.data)) return response;
  const filters = query instanceof URLSearchParams ? Object.fromEntries(query.entries()) : query;
  let rows = [...response.data];
  const search = String(filters.search ?? filters.q ?? "").trim().toLowerCase();
  if (search) rows = rows.filter((item) => JSON.stringify(item).toLowerCase().includes(search));
  for (const [key, value] of Object.entries(filters)) {
    if (["search", "q", "page", "pageSize", "limit", "sort", "direction", "from", "to"].includes(key) || value === "" || value == null) continue;
    const field = key === "level" ? "riskLevel" : key;
    if (rows.some((item) => Object.hasOwn(item, field))) {
      rows = rows.filter((item) => String(item[field]).toLowerCase() === String(value).toLowerCase());
    }
  }
  if (filters.from) rows = rows.filter((item) => !item.date || item.date >= filters.from);
  if (filters.to) rows = rows.filter((item) => !item.date || item.date <= filters.to);
  if (filters.sort) {
    const direction = String(filters.direction || "asc").toLowerCase() === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      const left = a[filters.sort] ?? "";
      const right = b[filters.sort] ?? "";
      return typeof left === "number" && typeof right === "number"
        ? (left - right) * direction
        : String(left).localeCompare(String(right)) * direction;
    });
  }
  const total = rows.length;
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.max(1, Number(filters.pageSize || filters.limit) || total || 1);
  if (filters.page || filters.pageSize || filters.limit) rows = rows.slice((page - 1) * pageSize, page * pageSize);
  return { ...response, data: rows, meta: { ...response.meta, total, page, pageSize } };
}

async function loadSample(name, signal) {
  if (sampleCache.has(name)) return structuredClone(sampleCache.get(name));
  const url = new URL(`../../data/samples/${name}.json`, import.meta.url);
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new ApiError({ code: "MOCK_SAMPLE_ERROR", message: `Mock sample "${name}" could not be loaded.`, status: response.status });
  }
  const sample = await response.json();
  sampleCache.set(name, sample);
  return structuredClone(sample);
}

async function refreshSession() {
  const { refreshToken } = getSession();
  if (!refreshToken) return false;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const body = envelope(await response.json()).data;
    if (!body?.accessToken || !body?.refreshToken) return false;
    saveSessionTokens(body.accessToken, body.refreshToken);
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

const dispatchPermissionError = () => document.dispatchEvent(new CustomEvent("app:toast", {
  detail: { message: "You do not have permission to complete this action.", type: "error" },
}));

async function performRequest(path, options, retry401 = true) {
  const { timeout = REQUEST_TIMEOUT_MS, signal, mockSample, mockTransform, mockListHandled, mockDelayRange, cacheTtlMs: requestedCacheTtl, onUploadProgress, query, ...fetchOptions } = options;
  if (signal?.aborted) throw normalizeApiError(signal.reason);
  const method = String(fetchOptions.method || "GET").toUpperCase();
  const cacheTtlMs = method === "GET" ? Number(requestedCacheTtl ?? READ_CACHE_TTL_MS) : 0;
  const cacheKey = `${method}:${path}:${getSession().user?.id || "anonymous"}`;
  const cached = responseCache.get(cacheKey);
  if (cacheTtlMs && cached && cached.expiresAt > Date.now()) return structuredClone(cached.value);
  if (USE_MOCK) {
    if (!mockSample) throw new ApiError({ code: "MOCK_SAMPLE_MISSING", message: `No mock sample is configured for ${path}.` });
    const sample = await loadSample(mockSample, signal);
    const [min = 400, max = 700] = mockDelayRange || [];
    await mockDelay(min, max, signal);
    const shaped = mockTransform ? await mockTransform(structuredClone(sample.data), sample.meta || {}, query || {}) : sample;
    let result = envelope(shaped);
    if (!mockListHandled) result = applyMockListQuery(result, query);
    validateResponse(path, result, method);
    if (cacheTtlMs) responseCache.set(cacheKey, { value: structuredClone(result), expiresAt: Date.now() + cacheTtlMs });
    if (method !== "GET") clearApiCache();
    return result;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(new DOMException("Request timed out.", "TimeoutError")), timeout);
  const relayAbort = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", relayAbort, { once: true });
  const headers = new Headers(fetchOptions.headers || {});
  headers.set("Accept", "application/json");
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const { token } = getSession();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const url = /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    if (fetchOptions.body instanceof FormData && typeof onUploadProgress === "function") {
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.timeout = timeout;
        headers.forEach((value, key) => xhr.setRequestHeader(key, value));
        const abortUpload = () => xhr.abort();
        controller.signal.addEventListener("abort", abortUpload, { once: true });
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) onUploadProgress({ loaded: event.loaded, total: event.total, percent: Math.round((event.loaded / event.total) * 100) });
        });
        xhr.addEventListener("load", async () => {
          controller.signal.removeEventListener("abort", abortUpload);
          let payload;
          try { payload = xhr.responseText ? JSON.parse(xhr.responseText) : null; }
          catch { reject(new ApiError({ code: "INVALID_RESPONSE", message: "The server returned an invalid response.", status: xhr.status })); return; }
          if (xhr.status === 401 && retry401 && await refreshSession()) {
            try { resolve(await performRequest(path, options, false)); } catch (error) { reject(error); }
            return;
          }
          if (xhr.status === 401) {
            signOut();
            window.location.assign("login.html");
            reject(new ApiError({ code: "UNAUTHENTICATED", message: "Your session has expired. Sign in again.", status: 401 }));
            return;
          }
          if (xhr.status === 403) {
            dispatchPermissionError();
            reject(new ApiError({ code: "FORBIDDEN", message: "You do not have permission to complete this action.", status: 403 }));
            return;
          }
          if (xhr.status < 200 || xhr.status >= 300) {
            const problem = payload?.error;
            reject(new ApiError({
              code: problem?.code || `HTTP_${xhr.status}`,
              message: problem?.message || `Request failed (${xhr.status}).`,
              status: xhr.status,
              details: problem?.details ?? null,
            }));
            return;
          }
          try {
            const result = envelope(payload);
            validateResponse(path, result, method);
            if (method !== "GET") clearApiCache();
            resolve(result);
          } catch (error) { reject(error); }
        });
        xhr.addEventListener("error", () => reject(new ApiError({ code: "NETWORK_ERROR", message: "Network error. Check your connection and retry." })));
        xhr.addEventListener("timeout", () => reject(new ApiError({ code: "REQUEST_TIMEOUT", message: "The request timed out. Please try again." })));
        xhr.addEventListener("abort", () => reject(normalizeApiError(signal?.reason || controller.signal.reason || new DOMException("Request aborted.", "AbortError"))));
        xhr.send(fetchOptions.body);
      });
    }
    const response = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });
    if (response.status === 401 && retry401 && await refreshSession()) {
      return performRequest(path, options, false);
    }
    if (response.status === 401) {
      signOut();
      window.location.assign("login.html");
      throw new ApiError({ code: "UNAUTHENTICATED", message: "Your session has expired. Sign in again.", status: 401 });
    }
    if (response.status === 403) {
      dispatchPermissionError();
      throw new ApiError({ code: "FORBIDDEN", message: "You do not have permission to complete this action.", status: 403 });
    }
    if (!response.ok) {
      const body = await response.text();
      let payload = body;
      try { payload = body ? JSON.parse(body) : null; } catch { payload = body; }
      const problem = payload?.error;
      throw new ApiError({
        code: problem?.code || `HTTP_${response.status}`,
        message: problem?.message || (typeof payload === "string" && payload) || `Request failed (${response.status}).`,
        status: response.status,
        details: problem?.details ?? null,
      });
    }
    const value = response.status === 204 ? { data: null, meta: {} } : envelope(await response.json());
    validateResponse(path, value, method);
    if (cacheTtlMs) responseCache.set(cacheKey, { value: structuredClone(value), expiresAt: Date.now() + cacheTtlMs });
    if (method !== "GET") clearApiCache();
    return value;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw normalizeApiError(controller.signal.reason || error);
    }
    if (signal?.aborted) throw normalizeApiError(signal.reason || error);
    if (error instanceof ApiError) throw error;
    throw normalizeApiError(error);
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", relayAbort);
  }
}

export function requestJson(path, options = {}) {
  return performRequest(path, options).catch((error) => { throw normalizeApiError(error); });
}

const queryString = (params = {}) => {
  const search = params instanceof URLSearchParams ? params : new URLSearchParams();
  if (!(params instanceof URLSearchParams)) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
};

export const api = Object.freeze({
  request: requestJson,
  get: (path, options = {}) => requestJson(`${path}${queryString(options.query)}`, { ...options, method: "GET" }),
  post: (path, body, options = {}) => requestJson(path, { ...options, method: "POST", body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: (path, body, options = {}) => requestJson(path, { ...options, method: "PUT", body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: (path, body, options = {}) => requestJson(path, { ...options, method: "PATCH", body: JSON.stringify(body) }),
  delete: (path, options = {}) => requestJson(path, { ...options, method: "DELETE" }),
});

export const apiRequest = requestJson;
export const unwrapResponse = (response) => response?.data;
export const toQueryString = queryString;
