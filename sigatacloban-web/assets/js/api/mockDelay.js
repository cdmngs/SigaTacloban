export function mockDelay(min = 400, max = 700, signal) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
    return Promise.reject(new RangeError("Mock delay bounds must be non-negative and ordered."));
  }
  const duration = min + Math.floor(Math.random() * (max - min + 1));
  if (signal?.aborted) return Promise.reject(signal.reason || new DOMException("Request aborted.", "AbortError"));
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, duration);
    const abort = () => {
      window.clearTimeout(timer);
      reject(signal.reason || new DOMException("Request aborted.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}
