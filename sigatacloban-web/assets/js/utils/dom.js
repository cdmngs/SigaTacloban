export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export function el(tagName, attributes = {}, children = []) {
  const element = document.createElement(tagName);
  for (const [name, value] of Object.entries(attributes)) {
    if (name === "className") element.className = String(value);
    else if (name === "textContent") element.textContent = String(value ?? "");
    else if (name.startsWith("on") && typeof value === "function") element.addEventListener(name.slice(2).toLowerCase(), value);
    else if (value !== null && value !== undefined) element.setAttribute(name, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child instanceof Node) element.append(child);
    else if (child !== null && child !== undefined) element.append(document.createTextNode(String(child)));
  }
  return element;
}
