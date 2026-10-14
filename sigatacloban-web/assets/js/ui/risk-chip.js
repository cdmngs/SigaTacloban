const labels = { low: "Low", moderate: "Moderate", high: "High", veryhigh: "Very high" };

export function createRiskChip(level) {
  if (!Object.hasOwn(labels, level)) throw new TypeError(`Unknown risk level: ${level}`);
  const chip = document.createElement("span");
  chip.className = `risk-chip risk-${level}`;
  const mark = document.createElement("i");
  mark.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.textContent = labels[level];
  chip.append(mark, text);
  return chip;
}
