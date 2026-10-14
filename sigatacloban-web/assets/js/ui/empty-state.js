import { iconSvg } from "./icons.js";

export function createEmptyState(title, detail, icon = "info") {
  const state = document.createElement("div");
  state.className = "shared-empty-state";
  state.setAttribute("role", "status");
  const mark = document.createElement("span");
  mark.className = "shared-empty-state-icon";
  mark.setAttribute("aria-hidden", "true");
  mark.innerHTML = iconSvg(icon, 16);
  const heading = document.createElement("strong");
  heading.textContent = title;
  const description = document.createElement("small");
  description.textContent = detail;
  state.append(mark, heading, description);
  return state;
}
