export const RISK_LEVELS = Object.freeze([
  Object.freeze({ key: "low", label: "Low", color: "#2E9E5B" }),
  Object.freeze({ key: "moderate", label: "Moderate", color: "#F4C430" }),
  Object.freeze({ key: "high", label: "High", color: "#F77F00" }),
  Object.freeze({ key: "veryhigh", label: "Very High", color: "#D62828" }),
]);

export const RISK_COLORS = Object.freeze(Object.fromEntries(RISK_LEVELS.map(({ key, color }) => [key, color])));
export const DEFAULT_RISK_THRESHOLDS = Object.freeze({ moderate: 40, high: 60, veryHigh: 80 });
