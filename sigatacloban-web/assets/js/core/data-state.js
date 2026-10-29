import { createEmptyState } from "../ui/empty-state.js";
import { createSkeleton } from "../ui/skeleton.js";
import { showToast } from "../ui/toast.js";
import { formatValue } from "../utils/format.js";

function isEmptyData(data) {
  return data === null || data === undefined || (Array.isArray(data) && data.length === 0);
}

function renderLoading(container, callbacks) {
  if (callbacks.loading) {
    callbacks.loading(container);
    return;
  }
  const skeleton = createSkeleton(callbacks.skeletonClass || "");
  const currentHeight = container.getBoundingClientRect().height;
  const height = Math.max(currentHeight, Number(callbacks.minHeight) || 0);
  if (height > 0) skeleton.style.height = `${height}px`;
  skeleton.style.width = "100%";
  container.replaceChildren(skeleton);
}

function renderErrorState(container, error, retry, callbacks) {
  if (callbacks.error) {
    callbacks.error(container, error, retry);
    return;
  }
  const state = createEmptyState(
    callbacks.errorTitle || "Unable to load data",
    formatValue(error?.message, "Please try again."),
    callbacks.errorIcon || "info",
  );
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-secondary button-sm";
  button.textContent = callbacks.retryLabel || "Retry";
  button.addEventListener("click", () => { void retry(); });
  state.append(button);
  container.replaceChildren(state);
}

export function loadData(apiFunction, parameters = [], callbacks = {}) {
  if (typeof apiFunction !== "function") throw new TypeError("A data loading function is required.");
  if (!(callbacks.container instanceof HTMLElement)) throw new TypeError("A data-state container element is required.");

  const { container } = callbacks;
  let controller = null;
  let sequence = 0;
  let destroyed = false;

  const load = async (nextParameters = parameters) => {
    if (destroyed) return undefined;
    controller?.abort();
    controller = new AbortController();
    const requestController = controller;
    const requestSequence = ++sequence;
    const args = Array.isArray(nextParameters) ? nextParameters : [nextParameters];
    renderLoading(container, callbacks);

    try {
      const data = await apiFunction(...args, requestController.signal);
      if (destroyed || requestController.signal.aborted || requestSequence !== sequence) return undefined;
      if ((callbacks.isEmpty || isEmptyData)(data)) {
        if (callbacks.empty) callbacks.empty(container, data, load);
        else {
          const empty = createEmptyState(
            callbacks.emptyTitle || "No data available",
            callbacks.emptyMessage || "There is nothing to show right now.",
            callbacks.emptyIcon || "info",
          );
          const action = typeof callbacks.emptyAction === "function" ? callbacks.emptyAction(container, data, load) : callbacks.emptyAction;
          if (typeof Node !== "undefined" && action instanceof Node) empty.append(action);
          container.replaceChildren(empty);
        }
      } else if (callbacks.success) callbacks.success(container, data);
      return data;
    } catch (error) {
      if (destroyed || requestController.signal.aborted || requestSequence !== sequence) return undefined;
      renderErrorState(container, error, () => load(nextParameters), callbacks);
      return undefined;
    }
  };

  return {
    load,
    cancel() {
      sequence++;
      controller?.abort();
      controller = null;
    },
    destroy() {
      sequence++;
      controller?.abort();
      controller = null;
      destroyed = true;
    },
  };
}

function normalizeFieldErrors(details) {
  if (Array.isArray(details)) {
    return details.flatMap((item) => {
      const field = item?.field || item?.loc?.at(-1);
      const message = item?.message || item?.msg || item?.reason;
      return field && message ? [[String(field), String(message)]] : [];
    });
  }
  if (!details || typeof details !== "object") return [];
  if (Array.isArray(details.errors)) return normalizeFieldErrors(details.errors);
  if (details.field && (details.message || details.reason)) {
    return [[String(details.field), String(details.message || details.reason)]];
  }
  const fields = details.fields && typeof details.fields === "object" ? details.fields : details;
  return Object.entries(fields).flatMap(([field, issue]) => {
    if (field === "message" || field === "reason") return [];
    const message = Array.isArray(issue) ? issue.join(", ") : issue?.message || issue?.msg || issue?.reason || issue;
    return typeof message === "string" || typeof message === "number" ? [[field, String(message)]] : [];
  });
}

export function renderFieldErrors(form, details) {
  if (!(form instanceof HTMLFormElement)) throw new TypeError("A form element is required.");
  form.querySelectorAll("[data-api-field-error]").forEach((node) => node.remove());
  form.querySelectorAll("[aria-invalid='true']").forEach((field) => field.removeAttribute("aria-invalid"));
  const errors = normalizeFieldErrors(details);
  for (const [name, message] of errors) {
    const field = form.elements.namedItem(name);
    if (!(field instanceof HTMLElement)) continue;
    field.setAttribute("aria-invalid", "true");
    const messageNode = document.createElement("small");
    messageNode.className = "field-error";
    messageNode.dataset.apiFieldError = "";
    messageNode.textContent = message;
    field.insertAdjacentElement("afterend", messageNode);
  }
  return errors;
}

export async function submitFormAction(form, action, { submitButton, onSuccess, onError } = {}) {
  if (!(form instanceof HTMLFormElement) || typeof action !== "function") {
    throw new TypeError("A form and action function are required.");
  }
  const button = submitButton || form.querySelector('[type="submit"]');
  if (button && (!(button instanceof HTMLElement) || !("disabled" in button))) {
    throw new TypeError("The submit control must support a disabled state.");
  }
  const wasDisabled = button?.disabled || false;
  const previousBusy = form.getAttribute("aria-busy");
  form.querySelectorAll("[data-api-field-error]").forEach((node) => node.remove());
  form.querySelectorAll("[aria-invalid='true']").forEach((field) => field.removeAttribute("aria-invalid"));
  if (button) button.disabled = true;
  form.setAttribute("aria-busy", "true");
  let result;
  try {
    result = await action();
  } catch (error) {
    renderFieldErrors(form, error?.details);
    showToast(formatValue(error?.message, "The action could not be completed."), "error");
    if (onError) await onError(error);
    throw error;
  } finally {
    if (previousBusy === null) form.removeAttribute("aria-busy");
    else form.setAttribute("aria-busy", previousBusy);
    if (button) button.disabled = wasDisabled;
  }
  if (onSuccess) await onSuccess(result);
  return result;
}
