import { USE_MOCKS } from "./config.js";
import { requestJson } from "./client.js";
import { mockDelay } from "./mockDelay.js";

const DEFAULT_ALERT_RULES = Object.freeze({
  moderateThreshold: 40, highThreshold: 60, veryHighThreshold: 80,
  channels: { inApp: true, email: false, sms: false }, quietHours: false,
  recipients: { admin: true, prevention: true, operations: true, analyst: false },
});
let alerts = [];
let rules = structuredClone(DEFAULT_ALERT_RULES);

export async function listAlerts() {
  if (USE_MOCKS) { await mockDelay(); return alerts.map((alert) => ({ ...alert })); }
  return requestJson("/alerts/operational");
}
export async function acknowledgeAlert(id, user) {
  if (USE_MOCKS) {
    await mockDelay();
    alerts = alerts.map((alert) => alert.id === id ? { ...alert, acknowledged: true, acknowledgedBy: user, acknowledgedAt: new Date().toISOString(), read: true } : alert);
    return;
  }
  return requestJson(`/alerts/${encodeURIComponent(id)}/acknowledge`, { method: "POST", body: JSON.stringify({ user }) });
}
export async function markAllRead() {
  if (USE_MOCKS) { await mockDelay(); alerts = alerts.map((alert) => ({ ...alert, read: true })); return; }
  return requestJson("/alerts/read", { method: "POST" });
}
export async function getAlertRules() {
  if (USE_MOCKS) { await mockDelay(); return structuredClone(rules); }
  return requestJson("/alerts/rules");
}
export async function saveAlertRules(nextRules) {
  if (USE_MOCKS) { await mockDelay(); rules = structuredClone(nextRules); return; }
  return requestJson("/alerts/rules", { method: "PUT", body: JSON.stringify(nextRules) });
}
export function pushMockAlert(alert) {
  alerts = [{ ...alert }, ...alerts];
}
