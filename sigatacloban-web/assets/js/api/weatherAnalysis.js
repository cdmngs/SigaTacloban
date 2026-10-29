import { api, unwrapResponse } from "./client.js";

export async function fetchWeatherAnalysis(options = {}) {
  return unwrapResponse(await api.get("/weather/current", { ...options, mockSample: "weather-current" }));
}

export async function fetchOpenMeteoWeather(options = {}) {
  return fetchWeatherAnalysis(options);
}

export async function fetchWeatherRiskDays(options = {}) {
  return unwrapResponse(await api.get("/weather/risk-days", { ...options, mockSample: "weather-risk-days" }));
}

export async function fetchWeatherHistory(from, to, options = {}) {
  return unwrapResponse(await api.get("/weather/history", { ...options, query: { from, to }, mockSample: "weather-history" }));
}

export async function fetchWeatherCorrelation(days, options = {}) {
  const { areaId, ...requestOptions } = options;
  return unwrapResponse(await api.get("/weather/correlation", {
    ...requestOptions,
    query: { days, ...(areaId ? { areaId } : {}) },
    mockSample: "weather-correlation",
  }));
}
