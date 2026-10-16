import { getSession } from "./core/auth.js";
import { canAccessRoute } from "./core/permissions.js";
import { renderLayout } from "./core/layout.js";
import { titleForPage, goTo } from "./core/router.js";
import { iconSvg } from "./ui/icons.js";

const body = document.body;
const shell = document.getElementById("app-shell");
const page = body.dataset.page;
const session = getSession();
const uiConsistencyStyles = document.createElement("link");
uiConsistencyStyles.rel = "stylesheet";
uiConsistencyStyles.href = "assets/css/ui-consistency.css?v=2";
const uiStylesReady = new Promise((resolve, reject) => {
  uiConsistencyStyles.addEventListener("load", resolve, { once: true });
  uiConsistencyStyles.addEventListener("error", reject, { once: true });
});
const skipLink = document.createElement("a");
skipLink.className = "skip-to-content";
skipLink.href = "#page-content";
skipLink.textContent = "Skip to content";
body.prepend(skipLink);
if (!document.getElementById("phase4-notifications-css")) {
  const notificationStyles = document.createElement("link");
  notificationStyles.id = "phase4-notifications-css";
  notificationStyles.rel = "stylesheet";
  notificationStyles.href = "assets/css/phase4-notifications.css";
  document.head.append(notificationStyles);
}
const standalone = ["login", "404"].includes(page);
const pagePath = page === "style-guide" ? "/style-guide" : `/${page}`;

document.documentElement.lang = "en-PH";
document.title = `${titleForPage(page)} · SigaTacloban`;

if (page === "index") {
  goTo(session.user ? "dashboard.html" : "login.html");
} else if (page === "login" && session.user) {
  goTo("dashboard.html");
} else if (page === "404" && !session.user) {
  window.location.replace("login.html");
} else if (!standalone && !session.user) {
  window.location.replace("login.html");
} else if (page !== "403" && !standalone && !canAccessRoute(session.user.role, pagePath)) {
  window.location.replace("403.html");
}

if (standalone) {
  const main = document.getElementById("page-content");
  if (page === "login") {
    const { mount } = await import("./pages/login.js");
    mount(main);
  } else {
    const { mount } = await import("./pages/errors.js");
    mount(main, page);
  }
} else if (page !== "index" && session.user && (page === "403" || canAccessRoute(session.user.role, pagePath))) {
  renderLayout(shell, page, session.user);
  const main = document.getElementById("page-content");
  if (page === "risk-map") main.classList.add("page-map");
  if (page === "403") {
    const { mount } = await import("./pages/errors.js");
    mount(main, page);
  } else if (page === "style-guide") {
    const { mount } = await import("./pages/style-guide.js");
    mount(main);
  } else if (["dashboard", "risk-map", "weather", "trends", "what-if", "ml-evaluation", "incidents", "coverage", "alerts", "reports", "users"].includes(page)) {
    const { mount } = await import(`./pages/${page}.js`);
    await mount(main, session.user);
  } else {
    window.location.replace("404.html");
  }
}

document.head.append(uiConsistencyStyles);
await uiStylesReady;

document.addEventListener("app:toast", (event) => {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("role", "status");
    stack.setAttribute("aria-live", "polite");
    stack.setAttribute("aria-atomic", "false");
    document.body.append(stack);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${event.detail?.type || "info"}`;
  const message = document.createElement("span");
  message.textContent = String(event.detail?.message || "");
  toast.append(message);
  if (typeof event.detail?.onAction === "function") {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "toast-action";
    action.textContent = String(event.detail.actionLabel || "Retry");
    action.addEventListener("click", () => {
      action.disabled = true;
      Promise.resolve(event.detail.onAction()).finally(() => toast.remove());
    });
    toast.append(action);
  }
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "toast-dismiss";
  dismiss.setAttribute("aria-label", "Dismiss notification");
  dismiss.innerHTML = iconSvg("close", 16);
  dismiss.addEventListener("click", () => toast.remove());
  toast.append(dismiss);
  stack.append(toast);
  window.setTimeout(() => toast.remove(), 5000);
});
