import { API_BASE_URL } from "./config.js";
import { getSession, signOut } from "../core/auth.js";

export class ApiError extends Error {
  constructor(message, { status = 0, cause } = {}) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
  }
}

const dispatchToast = (detail) => document.dispatchEvent(new CustomEvent("app:toast", { detail }));

export async function requestJson(path, options = {}) {
  const { timeout = 15000, signal, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(new DOMException("Request timed out.", "TimeoutError")), timeout);
  const relayAbort = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", relayAbort, { once: true });
  const session = getSession();
  const headers = new Headers(fetchOptions.headers || {});
  headers.set("Accept", "application/json");
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (session.token) headers.set("Authorization", `Bearer ${session.token}`);
  const url = /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const requestOptions = { ...fetchOptions, headers, signal: controller.signal };

  try {
    const response = await fetch(url, requestOptions);
    if (response.status === 401) {
      signOut();
      window.location.assign("login.html");
      throw new ApiError("Your session has expired. Sign in again.", { status: 401 });
    }
    if (response.status === 403) {
      dispatchToast({ message: "You do not have permission to complete this action.", type: "error" });
      throw new ApiError("Access denied.", { status: 403 });
    }
    if (!response.ok) {
      const body = await response.text();
      throw new ApiError(body || `Request failed (${response.status}).`, { status: response.status });
    }
    if (response.status === 204) return undefined;
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError || controller.signal.aborted) {
      if (controller.signal.aborted && !signal?.aborted) {
        throw new ApiError("The request timed out. Please try again.", { cause: error });
      }
      throw error;
    }
    if (error instanceof TypeError) {
      const retry = () => requestJson(path, options).catch((retryError) => {
        dispatchToast({ message: retryError.message || "The request could not be completed.", type: "error" });
      });
      dispatchToast({ message: "Network error. Check your connection and retry.", type: "error", actionLabel: "Retry", onAction: retry });
      throw new ApiError("Network error. Check your connection and retry.", { cause: error });
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", relayAbort);
  }
}

export const apiRequest = requestJson;
export const api = Object.freeze({
  request: requestJson,
  get: (path, options) => requestJson(path, { ...options, method: "GET" }),
  post: (path, body, options) => requestJson(path, { ...options, method: "POST", body: JSON.stringify(body) }),
  put: (path, body, options) => requestJson(path, { ...options, method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body, options) => requestJson(path, { ...options, method: "PATCH", body: JSON.stringify(body) }),
  delete: (path, options) => requestJson(path, { ...options, method: "DELETE" }),
});
