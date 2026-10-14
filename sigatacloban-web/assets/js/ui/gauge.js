export function renderGauge(container, score = 82, thresholds = { lowMax: 29, moderateMax: 54, highMax: 79 }) {
  const hasData = Number.isFinite(score) && score >= 0 && score <= 100;
  const scoreValue = hasData ? score : 0;
  const theta = Math.PI - (scoreValue / 100) * Math.PI;
  const x = 100 + 75 * Math.cos(theta);
  const y = 100 - 75 * Math.sin(theta);
  const labelText = !hasData ? "NO DATA" : scoreValue <= thresholds.lowMax ? "LOW" : scoreValue <= thresholds.moderateMax ? "MODERATE" : scoreValue <= thresholds.highMax ? "HIGH" : "VERY HIGH";
  const gauge = document.createElement("div");
  gauge.className = `risk-gauge${!hasData ? " gauge-no-data" : scoreValue >= 80 ? " gauge-pulse" : ""}`;
  const arc = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  arc.setAttribute("viewBox", "0 0 200 118");
  arc.setAttribute("role", "img");
  arc.setAttribute("aria-label", hasData ? `Risk score ${scoreValue}, ${labelText.toLowerCase()}` : "Risk score unavailable");
  for (const [d, color] of [
    ["M25 100 A75 75 0 0 1 58 35", "#2E9E5B"],
    ["M58 35 A75 75 0 0 1 99 25", "#F4C430"],
    ["M99 25 A75 75 0 0 1 151 45", "#F77F00"],
    ["M151 45 A75 75 0 0 1 175 100", "#D62828"],
  ]) {
    const segment = document.createElementNS("http://www.w3.org/2000/svg", "path");
    segment.setAttribute("d", d);
    segment.setAttribute("stroke", color);
    arc.append(segment);
  }
  if (!hasData) {
    const noDataArc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    noDataArc.setAttribute("cx", "100");
    noDataArc.setAttribute("cy", "100");
    noDataArc.setAttribute("r", "72");
    noDataArc.setAttribute("fill", "none");
    noDataArc.setAttribute("stroke", "#EADFD8");
    noDataArc.setAttribute("stroke-width", "2");
    noDataArc.setAttribute("stroke-dasharray", "4 5");
    arc.append(noDataArc);
  }
  if (hasData) {
    const needle = document.createElementNS("http://www.w3.org/2000/svg", "line");
    needle.setAttribute("x1", "100");
    needle.setAttribute("y1", "100");
    needle.setAttribute("x2", String(x));
    needle.setAttribute("y2", String(y));
    needle.setAttribute("class", "gauge-needle");
    arc.append(needle);
  }
  const hub = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  hub.setAttribute("cx", "100");
  hub.setAttribute("cy", "100");
  hub.setAttribute("r", "5");
  hub.setAttribute("class", "gauge-hub");
  arc.append(hub);
  const scoreElement = document.createElement("strong");
  scoreElement.textContent = hasData ? String(score) : "—";
  const caption = document.createElement("small");
  caption.textContent = labelText;
  const minimum = document.createElement("span");
  minimum.className = "gauge-min";
  minimum.textContent = "0";
  const maximum = document.createElement("span");
  maximum.className = "gauge-max";
  maximum.textContent = "100";
  gauge.append(arc, scoreElement, caption, minimum, maximum);
  container.replaceChildren(gauge);
}
