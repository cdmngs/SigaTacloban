export function mockDelay(min = 400, max = 700) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
    return Promise.reject(new RangeError("Mock delay bounds must be non-negative and ordered."));
  }
  const duration = min + Math.floor(Math.random() * (max - min + 1));
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}
