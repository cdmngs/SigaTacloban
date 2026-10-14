export function createCard(className = "") {
  const card = document.createElement("section");
  card.className = `surface-card guide-card ${className}`.trim();
  return card;
}
