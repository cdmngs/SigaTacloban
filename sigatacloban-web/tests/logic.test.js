import assert from "node:assert/strict";
import test from "node:test";
import { getManagedUsers, getUserInitials } from "../assets/js/core/auth.js";
import { canAccessRoute, filterNavigationGroups, rolePermissions, setRolePermissionsFromApi } from "../assets/js/core/permissions.js";
import { filterIncidents } from "../assets/js/api/incidents.js";
import { toCsv } from "../assets/js/utils/csv.js";
import { simulateRisk } from "../assets/js/utils/simulate-risk.js";
import { BARANGAY_NAMES } from "../assets/js/api/barangays.js";

const conditions = { temperatureC: 25, humidityPercent: 50, rainfallMm: 2, windKph: 10 };
const makeArea = (score) => ({
  whatIfBaseline: score,
  currentConditions: conditions,
  factors: [
    { label: "Historical frequency", value: score },
    { label: "Temperature", value: 25 },
    { label: "Low humidity", value: 50 },
    { label: "Low rainfall", value: 2 },
    { label: "Wind speed", value: 10 },
    { label: "Station distance", value: 10 },
  ],
});

test("simulateRisk preserves baseline scores and six factor values", () => {
  const result = simulateRisk(makeArea(42), conditions);
  assert.equal(result.score, 42);
  assert.equal(result.delta, 0);
  assert.equal(result.level, "moderate");
  assert.equal(result.factors.length, 6);
});

test("simulateRisk uses the configured risk thresholds", () => {
  const expected = new Map([
    [0, "low"], [39, "low"], [40, "moderate"], [59, "moderate"],
    [60, "high"], [79, "high"], [80, "veryhigh"], [100, "veryhigh"],
  ]);
  for (const [score, level] of expected) {
    assert.equal(simulateRisk(makeArea(score), conditions).level, level, `score ${score}`);
  }
});

test("simulateRisk preserves the React What-If regression result", () => {
  const area = {
    ...makeArea(62),
    currentConditions: { temperatureC: 25, humidityPercent: 42, rainfallMm: 0, windKph: 28 },
    factors: [
      { label: "Historical frequency", value: 62 }, { label: "Temperature", value: 30 },
      { label: "Low humidity", value: 42 }, { label: "Low rainfall", value: 0 },
      { label: "Wind speed", value: 28 }, { label: "Station distance", value: 10 },
    ],
  };
  const result = simulateRisk(area, { temperatureC: 35, humidityPercent: 42, rainfallMm: 0, windKph: 28 });
  assert.deepEqual({ score: result.score, delta: result.delta, level: result.level }, {
    score: 83, delta: 21, level: "veryhigh",
  });
  assert.equal(result.factors.length, 6);
});

test("managed accounts and initials match the current auth configuration", () => {
  assert.deepEqual(getManagedUsers().map(({ name, email, role }) => [name, email, role]), [
    ["Cale", "admin@bfp.gov.ph", "admin"],
    ["Josh Lewis", "prevention@bfp.gov.ph", "prevention"],
    ["John Earth", "operations@bfp.gov.ph", "operations"],
    ["Benedict Josef", "analyst@bfp.gov.ph", "analyst"],
  ]);
  assert.deepEqual(getManagedUsers().map(({ name }) => getUserInitials(name)), ["CA", "JL", "JE", "BJ"]);
});

test("navigation menu groups are filtered by the same role permissions as route guards", () => {
  const groups = [
    { label: "Overview", links: [["Dashboard", "dashboard"], ["Risk Map", "risk-map"]] },
    { label: "Analysis", links: [["What-If", "what-if"], ["ML Evaluation", "ml-evaluation"]] },
    { label: "Operations", links: [["Incidents", "incidents"], ["Alerts", "alerts"], ["Reports", "reports"]] },
    { label: "Admin", links: [["Users", "users"]] },
  ];
  const expected = {
    admin: ["dashboard", "risk-map", "what-if", "incidents", "alerts", "reports", "users"],
    prevention: ["dashboard", "risk-map", "what-if", "alerts", "reports"],
    operations: ["dashboard", "risk-map", "incidents", "alerts"],
    analyst: ["dashboard", "ml-evaluation", "incidents", "reports"],
  };
  for (const [role, paths] of Object.entries(expected)) {
    const visible = filterNavigationGroups(role, groups).flatMap((group) => group.links.map(([, slug]) => slug));
    assert.deepEqual(visible, paths);
    for (const slug of paths) assert.ok(rolePermissions[role].routes.includes(`/${slug}`));
    assert.equal(filterNavigationGroups(role, groups).some((group) => group.links.length === 0), false);
  }
  assert.equal(filterNavigationGroups("analyst", groups).flatMap((group) => group.links).some(([, slug]) => slug === "users"), false);
});

test("API role permissions drive routes and do not inherit static access", () => {
  const matrix = {
    customAdmin: { routes: ["/users"], capabilities: { userManagement: true } },
    readOnly: { users: ["read"] },
  };
  setRolePermissionsFromApi(matrix);
  assert.equal(canAccessRoute("customAdmin", "/users"), true);
  assert.equal(rolePermissions.customAdmin.capabilities.userManagement, true);
  assert.equal(canAccessRoute("readOnly", "/users"), false);
  assert.equal(rolePermissions.readOnly.capabilities.userManagement, false);
  assert.deepEqual(filterNavigationGroups("readOnly", [{ label: "Admin", links: [["Users", "users"]] }]), []);
});

test("incident filtering, date bounds, sorting and pagination are deterministic", () => {
  const incidents = [
    { id: "FS-003", barangay: "Sagkahan", date: "2026-05-03", fireClass: "B", severityLabel: "High", cause: "Wiring", responseMinutes: 11 },
    { id: "FS-001", barangay: "Abucay", date: "2026-05-01", fireClass: "A", severityLabel: "Low", cause: "Cooking", responseMinutes: 5 },
    { id: "FS-002", barangay: "Sagkahan", date: "2026-05-02", fireClass: "A", severityLabel: "Moderate", cause: "Electrical", responseMinutes: 8 },
  ];
  const result = filterIncidents(
    incidents,
    { search: "electric", barangay: "Sagkahan", from: "2026-05-02", to: "2026-05-03", fireClass: "A", severity: "Moderate" },
    1,
    1,
    { key: "date", direction: "asc" },
  );
  assert.deepEqual(result.rows.map(({ id }) => id), ["FS-002"]);
  assert.equal(result.total, 1);
  assert.deepEqual(incidents.map(({ id }) => id), ["FS-003", "FS-001", "FS-002"]);

  const page = filterIncidents(incidents, {}, 2, 1, { key: "date", direction: "asc" });
  assert.deepEqual(page.rows.map(({ id }) => id), ["FS-002"]);
  assert.equal(page.total, 3);
  assert.equal(page.page, 2);
});

test("CSV serialization quotes delimiters, quotes, line breaks and empty values", () => {
  assert.equal(
    toCsv(["Name", "Notes", "Count"], [["Cale", 'Called, said "ready"\r\nnow', null]]),
    '"Name","Notes","Count"\r\n"Cale","Called, said ""ready""\r\nnow",""',
  );
});

test("Tacloban barangay names are populated and alphabetically sorted", () => {
  assert.equal(BARANGAY_NAMES.length, 138);
  assert.equal(new Set(BARANGAY_NAMES).size, BARANGAY_NAMES.length);
  assert.ok(BARANGAY_NAMES.every((name) => typeof name === "string" && name.trim().length > 0));
  assert.deepEqual(
    BARANGAY_NAMES,
    [...BARANGAY_NAMES].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true })),
  );
});
