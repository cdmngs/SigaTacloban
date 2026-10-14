export function createSkeleton(className = "") {
  const skeleton = document.createElement("div");
  skeleton.className = `skeleton ${className}`.trim();
  skeleton.setAttribute("aria-hidden", "true");
  return skeleton;
}
