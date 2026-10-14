import { iconSvg } from "./icons.js";

const defaultFactors = [
  ["Historical frequency", 82], ["Temperature", 69], ["Low humidity", 61],
  ["Low rainfall", 55], ["Wind speed", 44], ["Station distance", 37],
];

export function renderRiskDna(container, factors = defaultFactors) {
  const list = document.createElement("div");
  list.className = "dna-bars";
  for (const factor of factors) {
    const name = Array.isArray(factor) ? factor[0] : factor.label;
    const rawValue = Array.isArray(factor) ? factor[1] : factor.value;
    const value = Math.max(0, Math.min(100, Number(rawValue) || 0));
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
    label.textContent = name;
    const track = document.createElement("span");
    track.className = "dna-track";
    const fill = document.createElement("i");
    fill.style.width = `${value}%`;
    fill.setAttribute("aria-hidden", "true");
    track.append(fill);
    const percent = document.createElement("b");
    percent.textContent = `${value}%`;
    row.append(icon, label, track, percent);
    list.append(row);
  }
  container.replaceChildren(list);
}
