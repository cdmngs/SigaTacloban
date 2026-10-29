import { api, unwrapResponse } from "./client.js";

export async function fetchWeather(options = {}) {
  return unwrapResponse(await api.get("/weather/current", { ...options, mockSample: "weather-current" }));
}

export async function fetchWeatherForecast(options = {}) {
  return unwrapResponse(await api.get("/weather/forecast", { ...options, mockSample: "weather-forecast" }));
}
