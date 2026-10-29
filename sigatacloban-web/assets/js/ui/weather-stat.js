import { formatNumber, formatValue } from "../utils/format.js";

export function createWeatherStat({ icon = null, value = "—", suffix = "", label = "" } = {}) {
  const stat = document.createElement("div");
  stat.className = "weather-stat";
  const glyph = document.createElement("span");
  glyph.className = "weather-stat-icon";
  glyph.setAttribute("aria-hidden", "true");
  if (typeof Node !== "undefined" && icon instanceof Node) glyph.append(icon);
  else if (icon !== null) glyph.textContent = String(icon);
  const figure = document.createElement("strong");
  const formattedValue = typeof value === "number" ? formatNumber(value, { maximumFractionDigits: 1 }) : formatValue(value);
  figure.textContent = `${formattedValue}${suffix ? `${suffix === "%" ? "" : " "}${suffix}` : ""}`;
  const caption = document.createElement("small");
  caption.textContent = formatValue(label);
  stat.append(glyph, figure, caption);
  return stat;
}
