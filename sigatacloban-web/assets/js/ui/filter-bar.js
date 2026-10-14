export function createFilterBar({ children = [], onReset } = {}) {
  const bar = document.createElement("div");
  bar.className = "filter-row filter-bar";
  for (const child of children) bar.append(child);
  if (onReset) {
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "text-action";
    reset.textContent = "Reset filters";
    reset.addEventListener("click", onReset);
    bar.append(reset);
  }
  return bar;
}
