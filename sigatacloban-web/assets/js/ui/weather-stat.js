export function createWeatherStat({ icon = null, value = "—", suffix = "", label = "" } = {}) {
  const stat = document.createElement("div");
  stat.className = "weather-stat";
  const glyph = document.createElement("span");
  glyph.className = "weather-stat-icon";
  glyph.setAttribute("aria-hidden", "true");
  if (icon instanceof Node) glyph.append(icon);
  else if (icon !== null) glyph.textContent = String(icon);
  const figure = document.createElement("strong");
  figure.textContent = `${value === null ? "—" : value}${suffix ? `${suffix === "%" ? "" : " "}${suffix}` : ""}`;
  const caption = document.createElement("small");
  caption.textContent = label;
  stat.append(glyph, figure, caption);
  return stat;
}
