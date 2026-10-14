export function createButton(label, { variant = "primary", className = "", type = "button" } = {}) {
  const button = document.createElement("button");
  button.type = type;
  button.className = `button button-${variant} ${className}`.trim();
  button.textContent = label;
  return button;
}
