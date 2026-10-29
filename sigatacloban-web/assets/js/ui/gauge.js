import { formatNumber, RISK_SCORE_MAX, RISK_SCORE_MIN } from "../utils/format.js";
import { appStore, subscribeToSharedData } from "../core/store.js";
import { RISK_LEVELS, riskLevelForScore } from "../utils/risk.js";

const gaugeSubscriptions = new WeakMap();

export function renderGauge(container, score = null, thresholds = null) {
  gaugeSubscriptions.get(container)?.();
  gaugeSubscriptions.delete(container);
  const configured = appStore.getState().riskThresholds;
  const boundaries = thresholds || {
    lowMax: configured.moderate - 1,
    moderateMax: configured.high - 1,
    highMax: configured.veryHigh - 1,
  };
  const hasData = Number.isFinite(score) && score >= RISK_SCORE_MIN && score <= RISK_SCORE_MAX;
  const scoreValue = hasData ? score : 0;
  const theta = Math.PI - (scoreValue / RISK_SCORE_MAX) * Math.PI;
  const x = 100 + 75 * Math.cos(theta);
  const y = 100 - 75 * Math.sin(theta);
  const riskKey = hasData ? riskLevelForScore(scoreValue, {
    moderate: boundaries.lowMax + 1,
    high: boundaries.moderateMax + 1,
    veryHigh: boundaries.highMax + 1,
  }) : null;
  const labelText = RISK_LEVELS.find(({ key }) => key === riskKey)?.label || "—";
  const gauge = document.createElement("div");
  gauge.className = `risk-gauge${!hasData ? " gauge-no-data" : scoreValue >= 80 ? " gauge-pulse" : ""}`;
  const arc = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  arc.setAttribute("viewBox", "0 0 200 118");
  arc.setAttribute("role", "img");
  arc.setAttribute("aria-label", hasData ? `Risk score ${scoreValue}, ${labelText.toLowerCase()}` : "Risk score unavailable");
  for (const [d, level] of [
    ["M25 100 A75 75 0 0 1 58 35", RISK_LEVELS[0]],
    ["M58 35 A75 75 0 0 1 99 25", RISK_LEVELS[1]],
    ["M99 25 A75 75 0 0 1 151 45", RISK_LEVELS[2]],
    ["M151 45 A75 75 0 0 1 175 100", RISK_LEVELS[3]],
  ]) {
    const segment = document.createElementNS("http://www.w3.org/2000/svg", "path");
    segment.setAttribute("d", d);
    segment.setAttribute("stroke", level.color);
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
  scoreElement.textContent = hasData ? formatNumber(score) : "—";
  const caption = document.createElement("small");
  caption.textContent = labelText;
  const minimum = document.createElement("span");
  minimum.className = "gauge-min";
  minimum.textContent = formatNumber(RISK_SCORE_MIN);
  const maximum = document.createElement("span");
  maximum.className = "gauge-max";
  maximum.textContent = formatNumber(RISK_SCORE_MAX);
  gauge.append(arc, scoreElement, caption, minimum, maximum);
  container.replaceChildren(gauge);
  if (!thresholds) {
    gaugeSubscriptions.set(container, subscribeToSharedData("riskThresholds", () => renderGauge(container, score)));
  }
}
