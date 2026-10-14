import { iconSvg } from "./icons.js";

const openDialogs = [];
let savedOverflow = "";

const focusableIn = (panel) => [...panel.querySelectorAll(
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
)].filter((element) => element.getClientRects().length > 0);

export function openOverlay({ title, subtitle = "", message = "", content = null, footer = null, kind = "modal", confirmLabel = "Done", cancelLabel = "Cancel", onConfirm, canClose = () => true, initialFocus = null, onClose }) {
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const backdrop = document.createElement("div");
  backdrop.className = `modal-backdrop${kind === "drawer" ? " overlay-backdrop-drawer" : kind === "sheet" ? " overlay-backdrop-sheet" : ""}`;
  const panel = document.createElement("section");
  panel.className = `modal-panel ${kind === "drawer" ? "drawer-panel" : kind === "sheet" ? "bottom-sheet-panel" : ""}`.trim();
  panel.tabIndex = -1;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", String(title));

  const header = document.createElement("header");
  const heading = document.createElement("h2");
  heading.textContent = String(title);
  const headingCopy = document.createElement("div");
  headingCopy.className = "modal-heading-copy";
  headingCopy.append(heading);
  if (subtitle) {
    const description = document.createElement("p");
    description.textContent = String(subtitle);
    headingCopy.append(description);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.className = "icon-button";
  close.setAttribute("aria-label", "Close dialog");
  close.innerHTML = iconSvg("close", 16);
  header.append(headingCopy, close);

  const body = document.createElement("div");
  body.className = "dialog-copy";
  if (content instanceof Node) body.append(content);
  else body.textContent = String(message ?? "");
  const actions = document.createElement("footer");
  actions.className = "dialog-actions";
  let footerElement = actions;
  let cancel = null;
  if (footer instanceof Node) {
    footerElement = footer;
  } else if (kind === "confirm") {
    cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "button button-secondary";
    cancel.textContent = cancelLabel;
    actions.append(cancel);
  }
  const done = document.createElement("button");
  done.type = "button";
  done.className = "button button-primary";
  done.textContent = confirmLabel;
  if (!(footer instanceof Node)) actions.append(done);
  panel.append(header, body, footerElement);
  backdrop.append(panel);
  document.body.append(backdrop);

  if (openDialogs.length === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.classList.add("modal-open");
  }

  const dialogState = { backdrop, panel, previousFocus, close: null };
  const isTop = () => openDialogs.at(-1) === dialogState;
  const closeOverlay = () => {
    if (!openDialogs.includes(dialogState)) return;
    window.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("focusin", keepFocusInside);
    backdrop.remove();
    openDialogs.splice(openDialogs.indexOf(dialogState), 1);
    if (openDialogs.length === 0) {
      document.body.classList.remove("modal-open");
      document.body.style.overflow = savedOverflow;
    }
    if (previousFocus?.isConnected) previousFocus.focus();
    onClose?.();
  };
  const requestClose = () => {
    if (canClose() !== false) closeOverlay();
  };
  dialogState.close = closeOverlay;
  const handleKeydown = (event) => {
    if (!isTop()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== "Tab") return;
    const elements = focusableIn(panel);
    if (!elements.length) { event.preventDefault(); panel.focus(); return; }
    if (event.shiftKey && document.activeElement === elements[0]) {
      event.preventDefault();
      elements.at(-1).focus();
    } else if (!event.shiftKey && document.activeElement === elements.at(-1)) {
      event.preventDefault();
      elements[0].focus();
    }
  };
  const keepFocusInside = (event) => {
    if (isTop() && !panel.contains(event.target)) (focusableIn(panel)[0] || panel).focus();
  };
  close.addEventListener("click", requestClose);
  cancel?.addEventListener("click", requestClose);
  footerElement.addEventListener("click", (event) => {
    if (event.target.closest(".overlay-cancel")) requestClose();
  });
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop && isTop()) requestClose();
  });
  done.addEventListener("click", () => {
    if (!isTop()) return;
    try { onConfirm?.(); } finally { closeOverlay(); }
  });
  window.addEventListener("keydown", handleKeydown);
  document.addEventListener("focusin", keepFocusInside);
  openDialogs.push(dialogState);
  (typeof initialFocus === "string" ? panel.querySelector(initialFocus) : initialFocus) instanceof HTMLElement
    ? (typeof initialFocus === "string" ? panel.querySelector(initialFocus) : initialFocus).focus()
    : (focusableIn(panel)[0] || panel).focus();
  return closeOverlay;
}

export const openModal = (options) => openOverlay({ ...options, kind: "modal" });
export const openConfirm = (options) => openOverlay({ ...options, kind: "confirm" });
export const openDrawer = (options) => openOverlay({ ...options, kind: "drawer" });
export const openBottomSheet = (options) => openOverlay({ ...options, kind: "sheet" });
