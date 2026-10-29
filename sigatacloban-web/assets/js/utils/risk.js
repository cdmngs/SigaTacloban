import { appStore } from "../core/store.js";
import { DEFAULT_RISK_THRESHOLDS, RISK_COLORS, RISK_LEVELS } from "./risk-config.js";

export { DEFAULT_RISK_THRESHOLDS, RISK_COLORS, RISK_LEVELS };

export function normalizeRiskLevel(value) {
  const key = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
  return RISK_LEVELS.some((level) => level.key === key) ? key : null;
}

export function getRiskThresholds() {
  return { ...DEFAULT_RISK_THRESHOLDS, ...appStore.getState().riskThresholds };
}

export function riskLevelForScore(score, thresholds = getRiskThresholds()) {
  if (!Number.isFinite(Number(score))) return null;
  const value = Number(score);
  if (value < thresholds.moderate) return "low";
  if (value < thresholds.high) return "moderate";
  if (value < thresholds.veryHigh) return "high";
  return "veryhigh";
}

export function riskColorForLevel(level) {
  return RISK_COLORS[normalizeRiskLevel(level)] || "#6E5B52";
}

export function riskLabelForLevel(level) {
  const key = normalizeRiskLevel(level);
  return RISK_LEVELS.find((item) => item.key === key)?.label || "—";
}
