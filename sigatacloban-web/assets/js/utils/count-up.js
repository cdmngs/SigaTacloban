export function countUp(target, durationOrOptions = 850, onUpdateCallback = () => {}) {
  const options = typeof durationOrOptions === "number"
    ? { duration: durationOrOptions, onUpdate: onUpdateCallback }
    : durationOrOptions;
  const { duration = 850, onUpdate = () => {}, signal } = options;
  const destination = Number.isFinite(Number(target)) ? Number(target) : 0;
  const startTime = performance.now();
  let frame = 0;
  const cancel = () => cancelAnimationFrame(frame);

  const tick = (time) => {
    if (signal?.aborted) return;
    const progress = Math.min(1, (time - startTime) / Math.max(1, duration));
    onUpdate(Math.round(destination * (1 - (1 - progress) ** 3)));
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  if (signal?.aborted) return cancel;
  frame = requestAnimationFrame(tick);
  signal?.addEventListener("abort", cancel, { once: true });
  return () => {
    cancel();
    signal?.removeEventListener("abort", cancel);
  };
}
