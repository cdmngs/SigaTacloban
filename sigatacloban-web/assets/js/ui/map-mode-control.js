import { iconSvg } from "./icons.js";

const modeOptions = [
  ["risk", "Risk", "shield"],
  ["hotspots", "Hotspots", "flame"],
  ["stations", "Stations", "radio"],
];

export function createMapModeControl({ value = "risk", onChange = () => {}, label = "Map mode", className = "" } = {}) {
  const control = document.createElement("div");
  control.className = `map-mode-control ${className}`.trim();
  control.setAttribute("role", "tablist");
  control.setAttribute("aria-label", label);
  const buttons = new Map();
  for (const [mode, text, icon] of modeOptions) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(mode === value));
    button.classList.toggle("active", mode === value);
    button.tabIndex = mode === value ? 0 : -1;
    button.innerHTML = iconSvg(icon, 13);
    const caption = document.createElement("span");
    caption.textContent = text;
    button.append(caption);
    button.addEventListener("click", () => setValue(mode, true));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = modeOptions.findIndex(([item]) => item === mode);
      const next = event.key === "Home" ? 0 : event.key === "End" ? modeOptions.length - 1 :
        (index + (event.key === "ArrowRight" ? 1 : -1) + modeOptions.length) % modeOptions.length;
      const nextMode = modeOptions[next][0];
      setValue(nextMode, true);
      buttons.get(nextMode).focus();
    });
    buttons.set(mode, button);
    control.append(button);
  }
  const setValue = (next, notify) => {
    if (!buttons.has(next)) throw new RangeError(`Unknown map mode: ${next}`);
    for (const [mode, button] of buttons) {
      button.setAttribute("aria-selected", String(mode === next));
      button.classList.toggle("active", mode === next);
      button.tabIndex = mode === next ? 0 : -1;
    }
    if (notify) onChange(next);
  };
  return { element: control, setValue: (next) => setValue(next, false), getValue: () => [...buttons].find(([, button]) => button.getAttribute("aria-selected") === "true")?.[0] };
}
