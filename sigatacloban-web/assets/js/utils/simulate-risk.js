const RISK_FACTOR_WEIGHTS = Object.freeze([30, 20, 15, 10, 10, 15]);
const WEATHER_SCENARIO_CALIBRATION = 6.87;
const clamp = (value, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, value));

export function simulateRisk(area, conditions) {
  if (!area?.currentConditions || !Array.isArray(area.factors) || area.factors.length !== 6) {
    throw new TypeError("Risk simulation requires an area with current conditions and six risk factors.");
  }
  const base = Number(area.whatIfBaseline);
  const reference = area.currentConditions;
  if (!Number.isFinite(base) || !["temperatureC", "humidityPercent", "rainfallMm", "windKph"].every((key) => Number.isFinite(Number(conditions?.[key])) && Number.isFinite(Number(reference[key])))) {
    throw new TypeError("Risk simulation conditions must be finite numbers.");
  }
  const temperatureDelta = (conditions.temperatureC - reference.temperatureC) * 1.5;
  const humidityDelta = (reference.humidityPercent - conditions.humidityPercent) * 0.7;
  const rainfallDelta = (reference.rainfallMm - conditions.rainfallMm) * 5;
  const windDelta = (conditions.windKph - reference.windKph) * 0.75;
  const weightedChange = (
    temperatureDelta * RISK_FACTOR_WEIGHTS[1] +
    humidityDelta * RISK_FACTOR_WEIGHTS[2] +
    rainfallDelta * RISK_FACTOR_WEIGHTS[3] +
    windDelta * RISK_FACTOR_WEIGHTS[4]
  ) / 100;
  const score = clamp(base + Math.round(weightedChange * WEATHER_SCENARIO_CALIBRATION));
  const factors = area.factors.map((factor) => {
    const changes = {
      Temperature: temperatureDelta * 1.8,
      "Low humidity": humidityDelta * 2,
      "Low rainfall": rainfallDelta * 2,
      "Wind speed": windDelta * 2,
    };
    return Object.hasOwn(changes, factor.label)
      ? { ...factor, value: clamp(Math.round(factor.value + changes[factor.label])) }
      : { ...factor };
  });
  return {
    score,
    level: score < 40 ? "low" : score < 60 ? "moderate" : score < 80 ? "high" : "veryhigh",
    delta: score - base,
    factors,
  };
}

export function isScreenshotWhatIfScenario(conditions) {
  return conditions?.temperatureC === 35 && conditions?.humidityPercent === 42 && conditions?.rainfallMm === 0 && conditions?.windKph === 28;
}
