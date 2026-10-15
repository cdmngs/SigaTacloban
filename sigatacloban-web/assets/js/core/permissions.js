export const roleLabels = Object.freeze({
  admin: "BFP Administrator",
  prevention: "Fire Prevention / Planning",
  operations: "Operations / Response",
  analyst: "Data Analyst",
});

export const rolePermissions = Object.freeze({
  admin: { routes: ["/dashboard", "/risk-map", "/weather", "/trends", "/what-if", "/incidents", "/coverage", "/alerts", "/reports", "/users", "/style-guide"], capabilities: { dashboardMap: true, manageIncidents: true, generateReports: true, modelEvaluation: false, userManagement: true, runWhatIf: true, alertRules: true, stationPlanning: true } },
  prevention: { routes: ["/dashboard", "/risk-map", "/weather", "/trends", "/what-if", "/coverage", "/reports", "/alerts"], capabilities: { dashboardMap: true, manageIncidents: false, generateReports: true, modelEvaluation: false, userManagement: false, runWhatIf: true, alertRules: true, stationPlanning: true } },
  operations: { routes: ["/dashboard", "/risk-map", "/incidents", "/coverage", "/alerts"], capabilities: { dashboardMap: true, manageIncidents: true, generateReports: false, modelEvaluation: false, userManagement: false, runWhatIf: false, alertRules: false, stationPlanning: false } },
  analyst: { routes: ["/dashboard", "/trends", "/weather", "/incidents", "/ml-evaluation", "/reports"], capabilities: { dashboardMap: true, manageIncidents: false, generateReports: true, modelEvaluation: true, userManagement: false, runWhatIf: false, alertRules: false, stationPlanning: false } },
});

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
