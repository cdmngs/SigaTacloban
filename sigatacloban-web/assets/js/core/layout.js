import { filterNavigationGroups, roleLabels } from "./permissions.js";
import { getRoleLabel, getUserInitials, signOut } from "./auth.js";
import { iconSvg } from "../ui/icons.js";
import { listAlerts } from "../api/alerts.js";
import { fetchCityRisk } from "../api/risk.js";
import { fetchWeatherAnalysis } from "../api/weatherAnalysis.js";
import { setSharedData, startRefreshTimer, subscribeToSharedData } from "./store.js";
import { logout } from "../api/auth.js";

const groups = [
  { label: "OVERVIEW", links: [["Dashboard", "dashboard", "dashboard"], ["Risk Map", "risk-map", "map"]] },
  { label: "ANALYSIS", links: [["Weather", "weather", "wind"], ["Trends", "trends", "chartNoAxesColumn"], ["What-If", "what-if", "slidersHorizontal"], ["ML Evaluation", "ml-evaluation", "sparkle"]] },
  { label: "OPERATIONS", links: [["Incidents", "incidents", "activity"], ["Coverage", "coverage", "radio"], ["Alerts", "alerts", "bell"], ["Reports", "reports", "file"]] },
  { label: "ADMIN", links: [["Users", "users", "users"], ["Style Guide", "style-guide", "sparkle"]] },
];
const hrefFor = (slug) => `${slug}.html`;
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function renderLayout(shell, page, user) {
  setSharedData({ currentUser: user });
  const titles = { "risk-map": "Risk Map", "what-if": "What-If", "ml-evaluation": "ML Evaluation", "style-guide": "Style Guide", users: "Users", "403": "Access denied" };
  const title = titles[page] || page.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
  const visibleGroups = filterNavigationGroups(user.role, groups);
  const renderLink = ([label, slug, icon]) =>
    `<a class="nav-link${page === slug ? " active" : ""}" href="${hrefFor(slug)}" ${page === slug ? 'aria-current="page"' : ""}>${iconSvg(icon, 16)}<span>${label}</span>${slug === "alerts" ? '<i class="nav-alert-count" hidden>0</i>' : ""}</a>`;
  const desktopGroups = visibleGroups.map((group) => {
    const links = group.links.map(renderLink).join("");
    return links ? `<section class="nav-group"><span class="nav-group-label">${group.label}</span>${links}</section>` : "";
  }).join("");
  const mobileLinks = visibleGroups.flatMap((group) => group.links);
  const primaryMobile = [
    ["Dashboard", "dashboard", "dashboard"],
    ["Map", "risk-map", "map"],
    ["Alerts", "alerts", "bell"],
    ["Reports", "reports", "file"],
  ].filter(([, slug]) => mobileLinks.some(([, visibleSlug]) => visibleSlug === slug));
  const moreLinks = mobileLinks.filter(([, slug]) => !primaryMobile.some(([, item]) => item === slug));
  shell.innerHTML = `
    <div class="app-frame">
      <aside class="sidebar" aria-label="Main navigation">
        <div class="sidebar-brand"><a class="brand-lockup" href="dashboard.html"><img class="brand-icon" src="assets/img/logo.png" alt="SigaTacloban" width="32" height="32"><span class="brand-type"><strong>SigaTacloban</strong></span></a><button class="icon-button sidebar-collapse" type="button" aria-label="Collapse navigation">${iconSvg("menu", 17)}</button></div>
        <nav class="sidebar-nav">${desktopGroups}</nav>
      </aside>
      <div class="app-main">
        <header class="topbar"><strong class="topbar-page-label">${esc(title)}</strong><div class="topbar-actions"><div class="notifications-wrap"><button class="icon-button notification-button" type="button" aria-label="Notifications" aria-expanded="false">${iconSvg("bell", 16)}<i class="notification-count" hidden>0</i></button><section class="alerts-popover" aria-label="Notifications" hidden><header><div><b>Notifications</b><small>0 unread alerts</small></div><a href="alerts.html">View all</a></header><div class="alerts-popover-list"><p class="notification-empty">You're all caught up.</p></div></section></div><div class="profile-wrap"><button class="profile-trigger" type="button" aria-expanded="false" aria-haspopup="menu"><span class="avatar">${esc(getUserInitials(user.name))}</span><span class="profile-copy"><b>${esc(user.name)}</b><small>${esc(getRoleLabel(user.role))}</small></span>${iconSvg("chevronDown", 14)}</button><div class="profile-menu" role="menu" aria-label="Profile menu" hidden><div class="profile-menu-heading">Signed in as ${esc(roleLabels[user.role])}</div><div class="profile-menu-divider"></div><button class="profile-signout" type="button" role="menuitem">${iconSvg("logOut", 15)}<span>Sign out</span></button></div></div></div></header>
        <main id="page-content" class="page-content"></main>
      </div>
      <nav class="bottom-nav" aria-label="Mobile navigation">${primaryMobile.map(([label, slug, icon]) => `<a class="bottom-nav-item${page === slug ? " active" : ""}" href="${hrefFor(slug)}" aria-label="${label}">${iconSvg(icon, 16)}<small>${label}</small></a>`).join("")}<button class="bottom-nav-item more-trigger" type="button" aria-label="More pages" aria-expanded="false">${iconSvg("more", 16)}<small>More</small></button></nav>
      <div class="more-sheet-backdrop" hidden><section class="more-sheet" role="dialog" aria-modal="true" aria-label="More navigation" tabindex="-1"><header><b>More</b><button class="more-close" type="button" aria-label="Close">${iconSvg("close", 16)}</button></header><div class="mobile-more-list">${moreLinks.map(([label, slug, icon]) => `<a class="mobile-more-link${page === slug ? " active" : ""}" href="${hrefFor(slug)}">${iconSvg(icon, 16)}${label}</a>`).join("")}<div class="mobile-role-note">${esc(getRoleLabel(user.role))}</div><button class="mobile-more-link mobile-signout" type="button">Sign out</button></div></section></div>
      <div class="toast-stack" role="status" aria-live="polite" aria-atomic="false"></div>
    </div>`;
  const trigger = shell.querySelector(".profile-trigger");
  const profileMenu = shell.querySelector(".profile-menu");
  const closeProfileMenu = (returnFocus = false) => {
    if (profileMenu.hidden) return;
    profileMenu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (returnFocus) trigger.focus();
  };
  trigger.addEventListener("click", () => {
    const opened = trigger.getAttribute("aria-expanded") === "true";
    trigger.setAttribute("aria-expanded", String(!opened));
    profileMenu.hidden = opened;
  });
  document.addEventListener("pointerdown", (event) => {
    if (!profileMenu.hidden && event.target instanceof Element && !event.target.closest(".profile-wrap")) closeProfileMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !profileMenu.hidden) {
      event.preventDefault();
      closeProfileMenu(true);
    }
  });
  const endSession = async () => {
    try { await logout(); }
    catch (error) {
      console.error("Server sign-out failed; clearing the local session.", error);
      signOut();
    } finally { window.location.assign("login.html"); }
  };
  shell.querySelector(".profile-signout").addEventListener("click", () => { void endSession(); });
  shell.querySelector(".mobile-signout").addEventListener("click", () => { void endSession(); });
  shell.querySelector(".sidebar-collapse").addEventListener("click", () => {
    const collapsed = shell.querySelector(".app-frame").classList.toggle("sidebar-collapsed");
    shell.querySelector(".sidebar-collapse").setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
  });
  const backdrop = shell.querySelector(".more-sheet-backdrop");
  const moreTrigger = shell.querySelector(".more-trigger");
  let previousFocus = null;
  const close = () => {
    backdrop.hidden = true;
    moreTrigger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("modal-open");
    document.removeEventListener("focusin", keepMoreFocusInside);
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  const keepMoreFocusInside = (event) => {
    const panel = backdrop.querySelector(".more-sheet");
    if (!backdrop.hidden && !panel.contains(event.target)) (panel.querySelector("button") || panel).focus();
  };
  moreTrigger.addEventListener("click", () => {
    previousFocus = document.activeElement;
    backdrop.hidden = false;
    moreTrigger.setAttribute("aria-expanded", "true");
    document.body.classList.add("modal-open");
    document.addEventListener("focusin", keepMoreFocusInside);
    backdrop.querySelector(".more-close").focus();
  });
  backdrop.querySelector(".more-close").addEventListener("click", close);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { close(); return; }
    if (event.key !== "Tab") return;
    const panel = backdrop.querySelector(".more-sheet");
    const focusable = [...panel.querySelectorAll('a[href],button:not([disabled])')];
    if (!focusable.length) { event.preventDefault(); panel.focus(); return; }
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
  });
  const notificationButton = shell.querySelector(".notification-button");
  const notificationPanel = shell.querySelector(".alerts-popover");
  const renderNotifications = ({ notifications, alertCount }) => {
    const alerts = notifications || [];
    const unread = Number(alertCount) || 0;
    for (const badge of shell.querySelectorAll(".notification-count,.nav-alert-count")) {
      badge.textContent = String(unread);
      badge.hidden = unread === 0;
    }
    notificationPanel.querySelector("header small").textContent = `${unread} unread alert${unread === 1 ? "" : "s"}`;
    const list = notificationPanel.querySelector(".alerts-popover-list");
    if (!alerts.length) {
      list.innerHTML = '<p class="notification-empty">You\'re all caught up.</p>';
      return;
    }
    list.replaceChildren(...alerts.slice(0, 5).map((alert) => {
      const item = document.createElement("a");
      item.className = `notification-item${alert.read ? "" : " unread"}`;
      item.href = alert.areaId ? `risk-map.html?area=${encodeURIComponent(alert.areaId)}` : "alerts.html";
      const title = document.createElement("b"); title.textContent = alert.message ?? "—";
      const detail = document.createElement("small"); detail.textContent = alert.area || (alert.type === "system" ? "System update" : "Risk notification");
      item.append(title, detail); return item;
    }));
  };
  const refreshNotifications = async () => {
    const alerts = await listAlerts();
    const unread = alerts.filter((alert) => !alert.read).length;
    setSharedData({ notifications: alerts, alertCount: unread });
    return alerts;
  };
  const unsubscribeNotifications = subscribeToSharedData(["notifications", "alertCount"], renderNotifications);
  const stopSharedRefresh = startRefreshTimer({
    notifications: refreshNotifications,
    riskScores: async () => setSharedData({ riskScores: await fetchCityRisk() }),
    weather: async () => setSharedData({ weather: await fetchWeatherAnalysis() }),
  }, {
    intervalMs: 60_000,
    onError: (error, resource) => {
      console.error(`Unable to refresh shared ${resource} data.`, error);
      if (resource === "notifications") {
        const list = notificationPanel.querySelector(".alerts-popover-list");
        list.replaceChildren();
        const message = document.createElement("p");
        message.className = "notification-empty";
        message.textContent = error.message || "Notifications could not be loaded.";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "button button-secondary button-sm";
        retry.textContent = "Retry";
        retry.addEventListener("click", () => { void refreshNotifications().catch((retryError) => console.error("Unable to load notification center.", retryError)); }, { once: true });
        list.append(message, retry);
      }
    },
  });
  window.addEventListener("pagehide", () => {
    unsubscribeNotifications();
    stopSharedRefresh();
  }, { once: true });
  notificationButton.addEventListener("click", async () => {
    const open = notificationPanel.hidden;
    notificationPanel.hidden = !open;
    notificationButton.setAttribute("aria-expanded", String(open));
    if (open) {
      try { await refreshNotifications(); }
      catch (error) {
        notificationPanel.querySelector(".alerts-popover-list").textContent = error.message || "Notifications could not be loaded.";
        console.error("Unable to load notification center", error);
      }
    }
  });
  document.addEventListener("click", (event) => {
    if (!shell.querySelector(".notifications-wrap").contains(event.target)) {
      notificationPanel.hidden = true;
      notificationButton.setAttribute("aria-expanded", "false");
    }
  });
}
