import { iconSvg } from "./icons.js";
import { formatValue } from "../utils/format.js";

export function createMapSidePanel({ title, content, footer = null, className = "" } = {}) {
  if (!(content instanceof Node)) throw new TypeError("Map side panel content must be a DOM node.");
  const panel = document.createElement("aside");
  panel.className = `map-side-panel ${className}`.trim();
  const panelTitle = formatValue(title);
  panel.setAttribute("aria-label", panelTitle);
  const toggle = document.createElement("button");
  toggle.className = "map-side-panel-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "true");
  const titleNode = document.createElement("span");
  titleNode.textContent = panelTitle;
  const chevron = document.createElement("span");
  chevron.className = "map-side-panel-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = iconSvg("chevronDown", 16);
  toggle.append(titleNode, chevron);
  const body = document.createElement("div");
  body.className = "map-side-panel-content";
  body.append(content);
  panel.append(toggle, body);
  if (footer instanceof Node) {
    const footerNode = document.createElement("div");
    footerNode.className = "map-side-panel-footer";
    footerNode.append(footer);
    panel.append(footerNode);
  }
  const media = window.matchMedia("(max-width: 767px)");
  const setCollapsed = (collapsed) => {
    body.hidden = collapsed;
    toggle.setAttribute("aria-expanded", String(!collapsed));
  };
  setCollapsed(media.matches);
  const onResize = (event) => setCollapsed(event.matches);
  media.addEventListener("change", onResize);
  toggle.addEventListener("click", () => setCollapsed(toggle.getAttribute("aria-expanded") === "true"));
  return {
    element: panel,
    destroy() { media.removeEventListener("change", onResize); },
  };
}
