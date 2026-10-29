import { formatRiskLevel } from "../utils/format.js";

export function createRiskChip(level) {
  const label = formatRiskLevel(level);
  const key = label === "—" ? "unknown" : label.toLowerCase().replace(/\s+/g, "");
  const chip = document.createElement("span");
  chip.className = `risk-chip risk-${key}`;
  const mark = document.createElement("i");
  mark.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.textContent = label;
  chip.append(mark, text);
  return chip;
}
