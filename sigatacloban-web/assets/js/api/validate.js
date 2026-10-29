function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const objectFields = {
  "/auth/login": { accessToken: "string", refreshToken: "string", user: "object" },
  "/auth/me": { id: "string", name: "string", email: "string", role: "string" },
  "/auth/refresh": { accessToken: "string", refreshToken: "string" },
  "/users": { id: "string", name: "string", email: "string", role: "string", active: "boolean", pendingInvite: "boolean" },
  "/users/{id}": { id: "string", name: "string", email: "string", role: "string", active: "boolean" },
  "/stations": { id: "string", name: "string", lat: "number", lng: "number", operational: "boolean" },
  "/stations/{id}": { id: "string", name: "string", lat: "number", lng: "number" },
  "/incidents": { id: "string", barangay: "string", date: "string", time: "string", fireClass: "string", severity: "string", responseMinutes: "number" },
  "/incidents/{id}": { id: "string", barangay: "string", date: "string", time: "string", fireClass: "string", severity: "string", responseMinutes: "number" },
  "/coverage": { score: "number", changePercent: "number", stations: "array", underserved: "array" },
  "/coverage/stations/plan": { id: "string", lat: "number", lng: "number", beforeScore: "number", afterScore: "number" },
  "/coverage/rings": { type: "string", features: "array" },
  "/trends": { period: "string", kpis: "object", points: "array" },
  "/models/evaluation": { models: "array", fileName: "string", uploadedRecords: "number", steps: "array" },
  "/models/datasets": { datasetId: "string", fileName: "string", uploadedRecords: "number", validation: "object" },
  "/models/retrain": { jobId: "string", status: "string" },
  "/models/jobs/{jobId}": { jobId: "string", status: "string" },
  "/models/active": { id: "string", active: "boolean" },
  "/weather/current": { temperatureC: "number", humidityPercent: "number", rainfallMm: "number", windKph: "number", updatedAt: "string" },
  "/dashboard/summary": { kpis: "object", topBarangays: "array", monthlyIncidents: "array", recentIncidents: "array" },
  "/risk/city": { riskScore: "number", riskLevel: "string", asOf: "string", horizonHours: "number" },
  "/risk/areas/{id}": { id: "string", name: "string", riskScore: "number", riskLevel: "string", factors: "array", nearestStation: "object" },
  "/alerts/rules": { moderateThreshold: "number", highThreshold: "number", veryHighThreshold: "number", channels: "object", recipients: "object" },
  "/roles/permissions": { admin: "object", prevention: "object", operations: "object", analyst: "object" },
  "/alerts/read": { updatedCount: "number" },
  "/alerts/{id}/acknowledge": { id: "string", acknowledged: "boolean", read: "boolean" },
  "/whatif/simulations": { riskScore: "number", riskLevel: "string", delta: "number", factors: "array" },
  "/whatif/scenarios": { id: "string", name: "string", areaId: "string", conditions: "object", riskScore: "number", riskLevel: "string", savedAt: "string" },
  "/reports/preview": { sections: "array" },
  "/reports/{id}/download": { contentType: "string", fileName: "string", contentBase64: "string" },
  "/reports": { id: "string", title: "string", fileName: "string", generatedBy: "string", generatedAt: "string", settings: "object" },
  "/geocoding/reverse": { name: "string", address: "string" },
  "/barangays/boundaries": { type: "string", features: "array" },
  "/users/{id}/activate": { id: "string", active: "boolean" },
  "/users/{id}/deactivate": { id: "string", active: "boolean" },
  "/users/{id}/password-reset": { id: "string", status: "string" },
  "/users/{id}/invite": { id: "string", status: "string" },
  "/incidents/export.csv": { contentType: "string", fileName: "string", content: "string" },
  "/trends/export.csv": { contentType: "string", fileName: "string", content: "string" },
};

const arrayFields = {
  "/users": { id: "string", name: "string", email: "string", role: "string", active: "boolean", pendingInvite: "boolean" },
  "/stations": { id: "string", name: "string", lat: "number", lng: "number", operational: "boolean" },
  "/incidents": { id: "string", barangay: "string", date: "string", time: "string", fireClass: "string", severity: "string", responseMinutes: "number" },
  "/risk/areas": { id: "string", name: "string", riskScore: "number", riskLevel: "string" },
  "/risk/forecast/{day}": { id: "string", name: "string", riskScore: "number", riskLevel: "string" },
  "/risk/hotspots": { id: "string", lat: "number", lng: "number", riskScore: "number" },
  "/weather/forecast": { date: "string", label: "string", highC: "number", condition: "string" },
  "/weather/risk-days": { date: "string", label: "string", riskScore: "number" },
  "/weather/history": { date: "string", temperatureC: "number", humidityPercent: "number", rainfallMm: "number", windKph: "number" },
  "/weather/correlation": { day: "string", riskScore: "number", temperatureC: "number" },
  "/alerts": { id: "string", type: "string", riskLevel: "string", message: "string", createdAt: "string", read: "boolean" },
  "/reports": { id: "string", title: "string", fileName: "string", generatedBy: "string", generatedAt: "string" },
  "/models/datasets": { datasetId: "string", fileName: "string", uploadedRecords: "number", validation: "object" },
  "/trends/barangays": { id: "string", name: "string", riskScore: "number" },
  "/whatif/areas": { id: "string", name: "string", riskScore: "number", riskLevel: "string", currentConditions: "object", factors: "array" },
  "/whatif/scenarios": { id: "string", name: "string", areaId: "string", conditions: "object", riskScore: "number", riskLevel: "string", savedAt: "string" },
  "/barangays": { id: "string", name: "string", center: "object" },
  "/geocoding/search": { id: "string", name: "string", lat: "number", lng: "number" },
  "/incidents/monthly": { year: "number", month: "string", count: "number" },
};

function invalidFields(value, fields) {
  return Object.entries(fields).filter(([field, type]) => {
    const item = value?.[field];
    if (item === null || item === undefined) return true;
    if (type === "array") return !Array.isArray(item);
    if (type === "object") return !isRecord(item);
    if (typeof item !== type) return true;
    if (["riskLevel", "severity"].includes(field) && !["Low", "Moderate", "High", "Very High"].includes(item)) return true;
    return false;
  }).map(([field]) => field);
}

export function validateResponse(endpoint, response, method = "GET") {
  if (response?.data === null && method !== "GET") return true;
  const path = endpoint.split("?")[0].replace(/^\/api\/v1/, "");
  const resourcePath = path
    .replace(/^\/users\/[^/]+(?=\/|$)/, "/users/{id}")
    .replace(/^\/incidents\/(?!monthly$|export\.csv$)[^/]+$/, "/incidents/{id}")
    .replace(/^\/stations\/[^/]+(?=\/|$)/, "/stations/{id}")
    .replace(/^\/risk\/areas\/[^/]+(?=\/|$)/, "/risk/areas/{id}")
    .replace(/^\/risk\/forecast\/[^/]+$/, "/risk/forecast/{day}")
    .replace(/^\/alerts\/[^/]+\/acknowledge$/, "/alerts/{id}/acknowledge")
    .replace(/^\/whatif\/scenarios\/[^/]+$/, "/whatif/scenarios")
    .replace(/^\/reports\/[^/]+\/download$/, "/reports/{id}/download")
    .replace(/^\/models\/jobs\/[^/]+$/, "/models/jobs/{jobId}")
    .replace(/^\/reports\/(?!preview$)[^/]+$/, "/reports/{id}");
  let invalid = [];
  const isList = method === "GET" && Boolean(arrayFields[resourcePath]);
  if (isList) {
    if (!Array.isArray(response?.data)) invalid = ["data"];
    else if (response.data.length) invalid = invalidFields(response.data[0], arrayFields[resourcePath]);
    if (!isRecord(response?.meta)) invalid.push("meta");
    else invalid.push(...invalidFields(response.meta, { total: "number", page: "number", pageSize: "number" }).map((field) => `meta.${field}`));
  } else if (objectFields[resourcePath]) {
    if (!isRecord(response?.data)) invalid = ["data"];
    else invalid = invalidFields(response.data, objectFields[resourcePath]);
  }
  if (invalid.length) console.warn(`[API validation] ${endpoint}: missing or invalid required field(s): ${invalid.join(", ")}.`);
  return invalid.length === 0;
}

export function validateFields(endpoint, value, fields) {
  const invalid = invalidFields(value, fields);
  if (invalid.length) console.warn(`[API validation] ${endpoint}: missing or invalid required field(s): ${invalid.join(", ")}.`);
  return invalid.length === 0;
}
