export const routePages = Object.freeze({
  "/": { file: "index.html", title: "Sign in", page: "index" },
  "/login": { file: "login.html", title: "Sign in", page: "login" },
  "/dashboard": { file: "dashboard.html", title: "Dashboard", page: "dashboard" },
  "/risk-map": { file: "risk-map.html", title: "Risk Map", page: "risk-map" },
  "/weather": { file: "weather.html", title: "Weather", page: "weather" },
  "/trends": { file: "trends.html", title: "Trends", page: "trends" },
  "/what-if": { file: "what-if.html", title: "What-If", page: "what-if" },
  "/ml-evaluation": { file: "ml-evaluation.html", title: "ML Evaluation", page: "ml-evaluation" },
  "/incidents": { file: "incidents.html", title: "Incidents", page: "incidents" },
  "/coverage": { file: "coverage.html", title: "Coverage", page: "coverage" },
  "/alerts": { file: "alerts.html", title: "Alerts", page: "alerts" },
  "/reports": { file: "reports.html", title: "Reports", page: "reports" },
  "/users": { file: "users.html", title: "Users", page: "users" },
  "/style-guide": { file: "style-guide.html", title: "Style Guide", page: "style-guide" },
  "/403": { file: "403.html", title: "Access denied", page: "403" },
  "/404": { file: "404.html", title: "Page not found", page: "404" },
});

export function goTo(file) {
  window.location.assign(file);
}

export function titleForPage(page) {
  return Object.values(routePages).find((route) => route.page === page)?.title || "Page not found";
}
