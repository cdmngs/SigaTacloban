import { USE_MOCKS } from "./config.js";
import { requestJson } from "./client.js";
import { mockDelay } from "./mockDelay.js";
export async function fetchWeather() {
  if (USE_MOCKS) { await mockDelay(); return null; }
  return requestJson("/weather/now");
}
export async function fetchWeatherForecast() {
  if (USE_MOCKS) { await mockDelay(); return []; }
  return requestJson("/weather/forecast");
}
