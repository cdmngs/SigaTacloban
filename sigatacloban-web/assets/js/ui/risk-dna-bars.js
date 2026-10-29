import { iconSvg } from "./icons.js";
import { formatPercent, formatValue } from "../utils/format.js";

export function renderRiskDna(container, factors = []) {
  const list = document.createElement("div");
  list.className = "dna-bars";
  for (const factor of Array.isArray(factors) ? factors : []) {
    const name = Array.isArray(factor) ? factor[0] : factor.label;
    const rawValue = Array.isArray(factor) ? factor[1] : factor.value;
    const numericValue = Number(rawValue);
    const hasValue = rawValue !== null && rawValue !== undefined && rawValue !== "" && Number.isFinite(numericValue);
    const value = hasValue ? Math.max(0, Math.min(100, numericValue)) : null;
    const iconName = ({
      "Historical frequency": "flame",
      Temperature: "thermometer",
      "Low humidity": "droplet",
      "Low rainfall": "rain",
      "Wind speed": "wind",
      "Station distance": "pin",
    })[name] ?? "info";
    const row = document.createElement("div");
    row.className = "dna-row";
    const icon = document.createElement("span");
    icon.className = "dna-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = iconSvg(iconName, 14);
    const label = document.createElement("span");
    label.className = "dna-label";
    label.textContent = formatValue(name);
    const track = document.createElement("span");
    track.className = "dna-track";
    const fill = document.createElement("i");
    fill.style.width = value === null ? "0%" : `${value}%`;
    fill.setAttribute("aria-hidden", "true");
    track.append(fill);
    const percent = document.createElement("b");
    percent.textContent = formatPercent(value);
    row.append(icon, label, track, percent);
    list.append(row);
  }
  container.replaceChildren(list);
}
