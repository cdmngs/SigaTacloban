export function observeMediaQuery(query, onChange) {
  if (typeof window.matchMedia !== "function") {
    onChange(false);
    return () => {};
  }
  const media = window.matchMedia(query);
  const update = (event) => onChange(event.matches);
  onChange(media.matches);
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}

export const matchesMediaQuery = (query) => typeof window.matchMedia === "function" && window.matchMedia(query).matches;
