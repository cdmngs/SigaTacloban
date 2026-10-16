import { USE_MOCKS } from "./config.js";
import { requestJson } from "./client.js";
import { mockDelay } from "./mockDelay.js";
const EMPTY_WEATHER_ANALYSIS = Object.freeze({
  temperatureC: 0, feelsLikeC: 0, humidityPercent: 0, rainfallMm: 0, windKph: 0,
  windDirection: "—", pressureHpa: 0, condition: "sun", updatedAt: "",
});
export async function fetchWeatherAnalysis() {
  if (USE_MOCKS) { await mockDelay(); return { ...EMPTY_WEATHER_ANALYSIS }; }
  return fetchOpenMeteoWeather();
}
export async function fetchOpenMeteoWeather() {
  if (USE_MOCKS) { await mockDelay(); return { ...EMPTY_WEATHER_ANALYSIS }; }
  const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=11.2444&longitude=125.0036&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,rain,wind_speed_10m,wind_direction_10m,surface_pressure,weather_code&timezone=Asia%2FManila");
  if (!response.ok) throw new Error(`Open-Meteo request failed (${response.status}).`);
  const payload = await response.json();
  const current = payload?.current;
  if (!current || !Number.isFinite(current.temperature_2m)) throw new TypeError("Open-Meteo returned an invalid current-weather response.");
  return {
    temperatureC: current.temperature_2m,
    feelsLikeC: current.apparent_temperature,
    humidityPercent: current.relative_humidity_2m,
    rainfallMm: current.rain,
    windKph: current.wind_speed_10m,
    windDirection: "—",
    pressureHpa: current.surface_pressure,
    condition: current.is_day ? "sun" : "rain",
    updatedAt: current.time,
  };
}
export async function fetchWeatherRiskDays() {
  if (USE_MOCKS) { await mockDelay(); return []; }
  return requestJson("/weather/risk-days");
}
export async function fetchWeatherCorrelation(days) {
  if (USE_MOCKS) { void days; await mockDelay(); return []; }
  return requestJson(`/weather/correlation?days=${encodeURIComponent(days)}`);
}
