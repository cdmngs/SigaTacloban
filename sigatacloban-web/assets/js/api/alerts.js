import { api, unwrapResponse } from "./client.js";
import { USE_MOCK } from "./config.js";

let mockAlerts;
let mockRules;
const MOCK_ALERTS_KEY = "sigatacloban-mock-alerts";
const MOCK_RULES_KEY = "sigatacloban-mock-alert-rules";

function restoreMockState() {
  if (!USE_MOCK) return;
  const storage = globalThis.sessionStorage;
  if (!storage) return;
  if (!mockAlerts) {
    const saved = storage.getItem(MOCK_ALERTS_KEY);
    if (saved !== null) {
      const alerts = JSON.parse(saved);
      if (!Array.isArray(alerts)) throw new TypeError("Saved mock alerts must be an array.");
      mockAlerts = alerts;
    }
  }
  if (!mockRules) {
    const saved = storage.getItem(MOCK_RULES_KEY);
    if (saved !== null) {
      const rules = JSON.parse(saved);
      if (!rules || typeof rules !== "object" || Array.isArray(rules)) throw new TypeError("Saved mock alert rules must be an object.");
      mockRules = rules;
    }
  }
}

function persistMockState() {
  if (!USE_MOCK) return;
  const storage = globalThis.sessionStorage;
  if (!storage) return;
  if (mockAlerts) storage.setItem(MOCK_ALERTS_KEY, JSON.stringify(mockAlerts));
  if (mockRules) storage.setItem(MOCK_RULES_KEY, JSON.stringify(mockRules));
}

export async function listAlerts(options = {}) {
  restoreMockState();
  const response = await api.get("/alerts", {
    ...options,
    mockSample: "alerts-list",
    mockTransform: (records) => {
      if (!mockAlerts) mockAlerts = records;
      persistMockState();
      return { data: mockAlerts, meta: { total: mockAlerts.length, page: 1, pageSize: mockAlerts.length } };
    },
  });
  return (unwrapResponse(response) || []).map((alert) => ({
    ...alert,
    level: alert.level || String(alert.riskLevel || "Low").toLowerCase().replace(/\s+/g, ""),
    score: alert.score ?? alert.riskScore,
  }));
}

export const fetchAlerts = listAlerts;

export async function acknowledgeAlert(id, user, options = {}) {
  restoreMockState();
  const response = await api.post(`/alerts/${encodeURIComponent(id)}/acknowledge`, {}, {
    ...options,
    mockSample: "alerts-acknowledge",
    mockTransform: (sample) => {
      mockAlerts = (mockAlerts || []).map((alert) => alert.id === id
        ? { ...alert, acknowledged: true, acknowledgedBy: user, acknowledgedAt: new Date().toISOString(), read: true }
        : alert);
      persistMockState();
      return { data: mockAlerts.find((alert) => alert.id === id) || sample, meta: {} };
    },
  });
  return unwrapResponse(response);
}

export async function markAllRead(options = {}) {
  restoreMockState();
  const response = await api.post("/alerts/read", {}, {
    ...options,
    mockSample: "alerts-read",
    mockTransform: (sample) => {
      mockAlerts = (mockAlerts || []).map((alert) => ({ ...alert, read: true }));
      persistMockState();
      return { data: sample, meta: {} };
    },
  });
  return unwrapResponse(response);
}

export async function getAlertRules(options = {}) {
  restoreMockState();
  return unwrapResponse(await api.get("/alerts/rules", {
    ...options,
    mockSample: "alerts-rules",
    mockTransform: (sample) => ({ data: mockRules || sample, meta: {} }),
  }));
}

export async function saveAlertRules(nextRules, options = {}) {
  restoreMockState();
  const response = await api.put("/alerts/rules", nextRules, {
    ...options,
    mockSample: "alerts-rules-put",
    mockTransform: () => {
      mockRules = structuredClone(nextRules);
      persistMockState();
      return { data: mockRules, meta: {} };
    },
  });
  return unwrapResponse(response);
}

export function pushMockAlert(alert) {
  restoreMockState();
  mockAlerts = [{ ...alert }, ...(mockAlerts || [])];
  persistMockState();
}
