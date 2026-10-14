export function showToast(message, kind = "success") {
  document.dispatchEvent(new CustomEvent("app:toast", {
    detail: { message: String(message), type: kind },
  }));
}
