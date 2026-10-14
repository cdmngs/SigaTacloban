export function createLogo({ size = 40, variant = "full" } = {}) {
  const lockup = document.createElement("span");
  lockup.className = "brand-lockup";
  const image = document.createElement("img");
  image.className = "brand-icon";
  image.src = "assets/img/logo.png";
  image.width = size;
  image.height = size;
  image.alt = "SigaTacloban";
  lockup.append(image);
  if (variant === "full") {
    const wordmark = document.createElement("span");
    wordmark.className = "brand-type";
    const name = document.createElement("strong");
    name.textContent = "SigaTacloban";
    wordmark.append(name);
    lockup.append(wordmark);
  }
  return lockup;
}
