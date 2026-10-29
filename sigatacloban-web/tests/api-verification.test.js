import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";

const root = new URL("../", import.meta.url);
const samplesRoot = new URL("assets/data/samples/", root);
const contractUrl = new URL("docs/API_CONTRACT.md", root);
let originalFetch;
let originalWindow;
let originalStorage;

before(() => {
  originalFetch = globalThis.fetch;
  originalWindow = globalThis.window;
  originalStorage = globalThis.localStorage;
  globalThis.window = {
    setTimeout(callback) { queueMicrotask(callback); return 0; },
    clearTimeout() {},
  };
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith("file:")) throw new Error(`Unexpected fetch during mock verification: ${url}`);
    const json = await readFile(fileURLToPath(url), "utf8");
    return new Response(json, { status: 200, headers: { "Content-Type": "application/json" } });
  };
});

after(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
});

test("every documented sample exists and uses a valid success/error envelope", async () => {
  const contract = await readFile(contractUrl, "utf8");
  const documented = new Set([...contract.matchAll(/\]\(\.\.\/assets\/data\/samples\/([^)]+\.json)\)/g)].map((match) => match[1]));
  assert.ok(documented.size > 0, "API contract should link its sample payloads");

  for (const name of documented) {
    const sample = JSON.parse(await readFile(new URL(name, samplesRoot), "utf8"));
    if (name === "error.json") {
      assert.equal(typeof sample.error?.code, "string", name);
      assert.equal(typeof sample.error?.message, "string", name);
      assert.ok(Object.hasOwn(sample.error, "details"), name);
    } else {
      assert.ok(Object.hasOwn(sample, "data"), `${name} needs data`);
      assert.ok(sample.meta && typeof sample.meta === "object" && !Array.isArray(sample.meta), `${name} needs meta`);
    }
  }
});

test("all checked-in JSON samples are referenced by the contract", async () => {
  const contract = await readFile(contractUrl, "utf8");
  const documented = new Set([...contract.matchAll(/\]\(\.\.\/assets\/data\/samples\/([^)]+\.json)\)/g)].map((match) => match[1]));
  const samples = (await readdir(samplesRoot)).filter((name) => name.endsWith(".json"));
  assert.deepEqual(samples.filter((name) => !documented.has(name)), []);
});

test("representative exports from every data API module return mock data in the documented shape", async () => {
  const modules = [
    ["alerts.js", "listAlerts", [], Array],
    ["auth.js", "getCurrentUser", [], Object],
    ["barangays.js", "listBarangays", [], Array],
    ["coverage.js", "getCoverage", [], Object],
    ["dashboard.js", "fetchDashboardSummary", [], Object],
    ["incidents.js", "listIncidents", [{}, 1, 25, { key: "date", direction: "desc" }], Object],
    ["models.js", "fetchModelEvaluation", [], Object],
    ["nominatim.js", "nominatimSearch", ["Tacloban"], Array],
    ["reports.js", "listReports", [], Array],
    ["risk.js", "fetchCityRisk", [], Object],
    ["stations.js", "fetchStations", [], Array],
    ["trends.js", "fetchTrends", ["12m"], Object],
    ["users.js", "listUsers", [], Array],
    ["weather.js", "fetchWeather", [], Object],
    ["weatherAnalysis.js", "fetchWeatherCorrelation", [30], Array],
    ["whatif.js", "fetchWhatIfAreas", [], Array],
  ];

  for (const [moduleName, functionName, args, expectedType] of modules) {
    const apiModule = await import(new URL(`assets/js/api/${moduleName}`, root));
    const result = await apiModule[functionName](...args);
    assert.ok(result instanceof expectedType, `${moduleName}:${functionName} returned ${typeof result}`);
  }
});

test("formatter output for empty and partial values never leaks null-like or invalid numbers", async () => {
  const { formatDate, formatNumber, formatPercent, formatTemperature, formatUnit, formatValue } =
    await import(new URL("assets/js/utils/format.js", root));
  const formatters = [
    formatValue, formatNumber, formatPercent, formatTemperature,
    (value) => formatUnit(value, "km/h"),
    formatDate,
  ];
  for (const formatter of formatters) {
    for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, "undefined", "NaN", "null"]) {
      const output = String(formatter(value));
      assert.equal(output.includes("undefined"), false);
      assert.equal(output.includes("NaN"), false);
      assert.equal(output.includes("null"), false);
      assert.ok(output === "—" || output.endsWith(" km/h") || output.endsWith(" °C") || output.endsWith("%"));
    }
  }
});

test("risk classification uses expected boundaries and shared custom alert thresholds", async () => {
  const { riskLevelForScore, getRiskThresholds } = await import(new URL("assets/js/utils/risk.js", root));
  const { setSharedData } = await import(new URL("assets/js/core/store.js", root));
  const expected = [[39, "low"], [40, "moderate"], [59, "moderate"], [60, "high"], [79, "high"], [80, "veryhigh"]];
  for (const [score, level] of expected) assert.equal(riskLevelForScore(score), level, `score ${score}`);

  setSharedData({ riskThresholds: { moderate: 30, high: 50, veryHigh: 70 } });
  assert.deepEqual(getRiskThresholds(), { moderate: 30, high: 50, veryHigh: 70 });
  assert.equal(riskLevelForScore(29), "low");
  assert.equal(riskLevelForScore(30), "moderate");
  assert.equal(riskLevelForScore(50), "high");
  assert.equal(riskLevelForScore(70), "veryhigh");
  setSharedData({ riskThresholds: { moderate: 40, high: 60, veryHigh: 80 } });
});
