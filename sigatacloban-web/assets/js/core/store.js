import { DEFAULT_RISK_THRESHOLDS } from "../utils/risk-config.js";

const initialSharedState = Object.freeze({
  currentUser: null,
  notifications: [],
  alertCount: 0,
  riskScores: null,
  weather: null,
  selectedBarangay: null,
  activeModel: null,
  incidentRefreshAt: 0,
  rolePermissions: null,
  riskThresholds: DEFAULT_RISK_THRESHOLDS,
  lastDataRefreshAt: null,
});

export function createStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();
  return {
    getState: () => state,
    setState(update) {
      const nextState = typeof update === "function" ? update(state) : { ...state, ...update };
      if (!nextState || typeof nextState !== "object" || Array.isArray(nextState)) {
        throw new TypeError("Store state must be an object.");
      }
      if (nextState === state) return state;
      state = nextState;
      for (const listener of [...listeners]) listener(state);
      return state;
    },
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("A store listener function is required.");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const appStore = createStore(initialSharedState);

const sharedChannel = typeof globalThis.window !== "undefined"
  && typeof globalThis.document !== "undefined"
  && typeof globalThis.BroadcastChannel === "function"
  ? new globalThis.BroadcastChannel("sigatacloban:shared-data")
  : null;

sharedChannel?.addEventListener("message", (event) => {
  const patch = event.data?.patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return;
  if (Object.keys(patch).some((key) => !Object.hasOwn(initialSharedState, key))) return;
  appStore.setState({ ...appStore.getState(), ...patch });
});

export function setSharedData(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new TypeError("Shared data updates must be an object.");
  }
  const update = {
    ...patch,
    lastDataRefreshAt: patch.lastDataRefreshAt ?? new Date().toISOString(),
  };
  const state = appStore.setState(update);
  sharedChannel?.postMessage({ patch: update });
  return state;
}

export function updateSharedData(key, value) {
  if (!Object.hasOwn(initialSharedState, key)) throw new RangeError(`Unknown shared data key: ${key}`);
  return setSharedData({ [key]: value });
}

export function subscribeToSharedData(keys, listener, { emitCurrent = false } = {}) {
  const selectedKeys = Array.isArray(keys) ? keys : [keys];
  if (selectedKeys.some((key) => !Object.hasOwn(initialSharedState, key))) {
    throw new RangeError("A shared data subscription includes an unknown key.");
  }
  if (typeof listener !== "function") throw new TypeError("A shared data listener function is required.");
  let previous = selectedKeys.map((key) => appStore.getState()[key]);
  const unsubscribe = appStore.subscribe((state) => {
    const next = selectedKeys.map((key) => state[key]);
    if (!next.some((value, index) => !Object.is(value, previous[index]))) return;
    previous = next;
    listener(selectedKeys.length === 1 ? next[0] : Object.fromEntries(selectedKeys.map((key, index) => [key, next[index]])), state);
  });
  if (emitCurrent) {
    const state = appStore.getState();
    listener(selectedKeys.length === 1 ? state[selectedKeys[0]] : Object.fromEntries(selectedKeys.map((key) => [key, state[key]])), state);
  }
  return unsubscribe;
}

export function startRefreshTimer(refreshers, {
  intervalMs = 60_000,
  immediate = true,
  documentRef = globalThis.document,
  onError = (error, key) => console.error(`Shared ${key || "data"} refresh failed.`, error),
} = {}) {
  const jobs = typeof refreshers === "function" ? [["data", refreshers]] : Object.entries(refreshers || {});
  if (!jobs.length || jobs.some(([, refresh]) => typeof refresh !== "function")) {
    throw new TypeError("At least one shared data refresh function is required.");
  }
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new RangeError("Refresh interval must be a positive number.");

  let stopped = false;
  let timer = null;
  let running = false;

  const schedule = () => {
    if (stopped || running || documentRef?.hidden) return;
    clearTimeout(timer);
    timer = setTimeout(() => { void run(); }, intervalMs);
  };
  const run = async () => {
    if (stopped || running || documentRef?.hidden) return;
    running = true;
    try {
      const results = await Promise.allSettled(jobs.map(([, refresh]) => Promise.resolve().then(refresh)));
      if (stopped) return;
      results.forEach((result, index) => {
        if (result.status === "rejected") onError(result.reason, jobs[index][0]);
      });
      if (results.some((result) => result.status === "fulfilled")) {
        setSharedData({ lastDataRefreshAt: new Date().toISOString() });
      }
    } finally {
      running = false;
      schedule();
    }
  };
  const onVisibilityChange = () => {
    if (documentRef?.hidden) {
      clearTimeout(timer);
      timer = null;
    } else {
      void run();
    }
  };

  documentRef?.addEventListener?.("visibilitychange", onVisibilityChange);
  if (immediate) void run();
  else schedule();

  return () => {
    stopped = true;
    clearTimeout(timer);
    documentRef?.removeEventListener?.("visibilitychange", onVisibilityChange);
  };
}
