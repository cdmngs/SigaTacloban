const MISSING = "—";
import { riskLabelForLevel } from "./risk.js";

export function formatValue(value, fallback = MISSING) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  if (typeof value === "string" && (!value.trim() || ["null", "undefined", "nan"].includes(value.trim().toLowerCase()))) return fallback;
  return String(value);
}

export function formatNumber(value, options = {}) {
  if (value === null || value === undefined || value === "") return MISSING;
  const number = Number(value);
  if (!Number.isFinite(number)) return MISSING;
  const { locale = "en-PH", ...numberOptions } = options;
  return new Intl.NumberFormat(locale, numberOptions).format(number);
}

export function formatPercent(value, options = {}) {
  if (value === null || value === undefined || value === "") return MISSING;
  const number = Number(value);
  return Number.isFinite(number) ? `${formatNumber(number, options)}%` : MISSING;
}

export function formatTemperature(value, options = {}) {
  if (value === null || value === undefined || value === "") return MISSING;
  const number = Number(value);
  return Number.isFinite(number) ? `${formatNumber(number, options)} °C` : MISSING;
}

export function formatUnit(value, unit, options = {}) {
  const formatted = typeof value === "number" ? formatNumber(value, options) : formatValue(value);
  return formatted === MISSING || !unit ? formatted : `${formatted} ${unit}`;
}

export function formatDate(value, options = {}) {
  if (value === null || value === undefined || value === "") return MISSING;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return MISSING;
  const { locale = "en-PH", ...dateOptions } = options;
  return new Intl.DateTimeFormat(locale, dateOptions).format(date);
}

export function formatDateTime(value, options = {}) {
  return formatDate(value, {
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  });
}

export function formatTime(value, options = {}) {
  if (value === null || value === undefined || value === "") return MISSING;
  const date = value instanceof Date ? value : new Date(`1970-01-01T${value}`);
  if (!Number.isFinite(date.getTime())) return MISSING;
  const { locale = "en-PH", ...timeOptions } = options;
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    ...timeOptions,
  }).format(date);
}

export function formatRiskLevel(value) {
  return riskLabelForLevel(value);
}

export const RISK_SCORE_MIN = 0;
export const RISK_SCORE_MAX = 100;
export { DEFAULT_RISK_THRESHOLDS } from "./risk.js";
