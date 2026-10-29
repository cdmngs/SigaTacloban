export const roleLabels = Object.freeze({
  admin: "BFP Administrator",
  prevention: "Fire Prevention / Planning",
  operations: "Operations / Response",
  analyst: "Data Analyst",
});

const defaultRolePermissions = Object.freeze({
  admin: { routes: ["/dashboard", "/risk-map", "/weather", "/trends", "/what-if", "/incidents", "/coverage", "/alerts", "/reports", "/users", "/style-guide"], capabilities: { dashboardMap: true, manageIncidents: true, generateReports: true, modelEvaluation: false, userManagement: true, runWhatIf: true, alertRules: true, stationPlanning: true } },
  prevention: { routes: ["/dashboard", "/risk-map", "/weather", "/trends", "/what-if", "/coverage", "/reports", "/alerts"], capabilities: { dashboardMap: true, manageIncidents: false, generateReports: true, modelEvaluation: false, userManagement: false, runWhatIf: true, alertRules: true, stationPlanning: true } },
  operations: { routes: ["/dashboard", "/risk-map", "/incidents", "/coverage", "/alerts"], capabilities: { dashboardMap: true, manageIncidents: true, generateReports: false, modelEvaluation: false, userManagement: false, runWhatIf: false, alertRules: false, stationPlanning: false } },
  analyst: { routes: ["/dashboard", "/trends", "/weather", "/incidents", "/ml-evaluation", "/reports"], capabilities: { dashboardMap: true, manageIncidents: false, generateReports: true, modelEvaluation: true, userManagement: false, runWhatIf: false, alertRules: false, stationPlanning: false } },
});

export let rolePermissions = defaultRolePermissions;

const routeCapabilityMap = Object.freeze({
  "/dashboard": "dashboardMap",
  "/risk-map": "dashboardMap",
  "/weather": "dashboardMap",
  "/trends": "dashboardMap",
  "/what-if": "runWhatIf",
  "/incidents": "manageIncidents",
  "/coverage": "stationPlanning",
  "/alerts": "dashboardMap",
  "/reports": "generateReports",
  "/users": "userManagement",
  "/ml-evaluation": "modelEvaluation",
  "/style-guide": "userManagement",
});

const resourceCapabilities = Object.freeze({
  "/users": "userManagement",
  "/incidents": "manageIncidents",
  "/reports": "generateReports",
  "/models": "modelEvaluation",
  "/whatif": "runWhatIf",
  "/coverage": "stationPlanning",
  "/risk": "dashboardMap",
  "/weather": "dashboardMap",
  "/dashboard": "dashboardMap",
});

function isAllowed(value, capability) {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const required = ["userManagement", "manageIncidents", "runWhatIf", "alertRules", "stationPlanning"].includes(capability)
      ? ["write", "manage", "admin"]
      : ["read", "write", "manage", "admin"];
    return value.some((permission) => required.includes(String(permission).toLowerCase()));
  }
  return Boolean(value && typeof value === "object" && (value.allowed === true || value.read || value.write || value.manage));
}

function normalizeRolePermissions(matrix) {
  if (!matrix || typeof matrix !== "object") throw new TypeError("The role-permission response must be an object.");
  const result = {};
  for (const [role, permissions] of Object.entries(matrix)) {
    if (!permissions || typeof permissions !== "object") continue;
    const capabilities = Object.fromEntries([
      "dashboardMap",
      "manageIncidents",
      "generateReports",
      "modelEvaluation",
      "userManagement",
      "runWhatIf",
      "alertRules",
      "stationPlanning",
    ].map((capability) => [capability, false]));
    if (permissions.capabilities && typeof permissions.capabilities === "object") {
      Object.assign(capabilities, permissions.capabilities);
    } else {
      for (const [resource, permission] of Object.entries(permissions)) {
        const key = resourceCapabilities[`/${resource}`];
        if (key) capabilities[key] = isAllowed(permission, key);
      }
    }
    const routes = Array.isArray(permissions.routes)
      ? permissions.routes.filter((path) => typeof path === "string")
      : Object.entries(routeCapabilityMap).filter(([, key]) => capabilities[key]).map(([path]) => path);
    result[role] = { routes, capabilities, permissions };
  }
  rolePermissions = Object.freeze(result);
  return rolePermissions;
}

export function setRolePermissionsFromApi(matrix) {
  return normalizeRolePermissions(matrix);
}

export function getRoleCodes() {
  return Object.keys(rolePermissions);
}

export function canAccessRoute(role, path) {
  return Boolean(rolePermissions[role]?.routes.includes(path));
}

export function filterNavigationGroups(role, groups) {
  const routes = rolePermissions[role]?.routes || [];
  return groups
    .map((group) => ({
      ...group,
      links: group.links.filter(([, slug]) => routes.includes(`/${slug}`)),
    }))
    .filter((group) => group.links.length > 0);
}
