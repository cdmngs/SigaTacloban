import test from "node:test";
import assert from "node:assert/strict";

import { loadData } from "../assets/js/core/data-state.js";
import { appStore, setSharedData, startRefreshTimer, subscribeToSharedData } from "../assets/js/core/store.js";
import { formatDate, formatNumber, formatPercent, formatTemperature, formatValue } from "../assets/js/utils/format.js";

test("shared formatters normalize absent, invalid, numeric and date values", () => {
  assert.equal(formatValue(null), "—");
  assert.equal(formatValue("undefined"), "—");
  assert.equal(formatNumber(Number.NaN), "—");
  assert.equal(formatPercent(null), "—");
  assert.equal(formatPercent(12.5, { maximumFractionDigits: 1 }), "12.5%");
  assert.equal(formatTemperature(21), "21 °C");
  assert.notEqual(formatDate("not-a-date"), "Invalid Date");
});

test("shared store publishes relevant fields and records refresh time", () => {
  const updates = [];
  const unsubscribe = subscribeToSharedData("alertCount", (count) => updates.push(count));
  const before = appStore.getState().lastDataRefreshAt;
  setSharedData({ alertCount: 3, notifications: [{ id: "alert-1" }] });
  unsubscribe();
  setSharedData({ alertCount: 4 });

  assert.deepEqual(updates, [3]);
  assert.equal(appStore.getState().alertCount, 4);
  assert.notEqual(appStore.getState().lastDataRefreshAt, before);
});

test("shared store propagates updates between browser tabs", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousChannel = globalThis.BroadcastChannel;
  const channels = new Map();
  globalThis.window = {};
  globalThis.document = {};
  globalThis.BroadcastChannel = class {
    constructor(name) {
      this.listeners = new Set();
      const members = channels.get(name) || new Set();
      members.add(this);
      channels.set(name, members);
    }
    addEventListener(_type, listener) { this.listeners.add(listener); }
    postMessage(data) {
      for (const channel of channels.get("sigatacloban:shared-data")) {
        if (channel !== this) for (const listener of channel.listeners) listener({ data });
      }
    }
  };
  try {
    const suffix = Date.now();
    const first = await import(`../assets/js/core/store.js?tab=${suffix}-1`);
    const second = await import(`../assets/js/core/store.js?tab=${suffix}-2`);
    first.setSharedData({ incidentRefreshAt: 123 });
    assert.equal(second.appStore.getState().incidentRefreshAt, 123);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousChannel === undefined) delete globalThis.BroadcastChannel;
    else globalThis.BroadcastChannel = previousChannel;
  }
});

test("shared refresh pauses while hidden and resumes on visibility", async () => {
  const listeners = new Set();
  const documentRef = {
    hidden: true,
    addEventListener: (_name, listener) => listeners.add(listener),
    removeEventListener: (_name, listener) => listeners.delete(listener),
  };
  let calls = 0;
  const stop = startRefreshTimer({ weather: () => { calls++; } }, {
    documentRef,
    immediate: true,
    intervalMs: 1000,
    onError: (error) => { throw error; },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 0);
  documentRef.hidden = false;
  for (const listener of listeners) listener();
  await new Promise((resolve) => setTimeout(resolve, 0));
  stop();
  assert.equal(calls, 1);
});

test("loadData cancels and ignores outdated responses", async () => {
  const previousHTMLElement = globalThis.HTMLElement;
  globalThis.HTMLElement = class HTMLElement {};
  try {
    const container = new HTMLElement();
    const pending = [];
    const rendered = [];
    const loader = loadData((value, signal) => new Promise((resolve) => pending.push({ value, signal, resolve })), ["first"], {
      container,
      loading: () => {},
      success: (_container, data) => rendered.push(data),
    });

    const oldRequest = loader.load(["first"]);
    const latestRequest = loader.load(["latest"]);
    pending[0].resolve("old");
    pending[1].resolve("new");
    await Promise.all([oldRequest, latestRequest]);

    assert.equal(pending[0].signal.aborted, true);
    assert.deepEqual(rendered, ["new"]);
    loader.destroy();
  } finally {
    if (previousHTMLElement === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = previousHTMLElement;
  }
});

test("loadData renders loading before success", async () => {
  const previousHTMLElement = globalThis.HTMLElement;
  globalThis.HTMLElement = class HTMLElement {};
  try {
    const container = new HTMLElement();
    const states = [];
    const loader = loadData(async () => ({ value: 42 }), [], {
      container,
      loading: () => states.push("loading"),
      success: (_container, data) => states.push(`success:${data.value}`),
    });

    await loader.load();

    assert.deepEqual(states, ["loading", "success:42"]);
    loader.destroy();
  } finally {
    if (previousHTMLElement === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = previousHTMLElement;
  }
});

test("loadData renders empty and error states and retries the failed request", async () => {
  const previousHTMLElement = globalThis.HTMLElement;
  globalThis.HTMLElement = class HTMLElement {};
  try {
    const container = new HTMLElement();
    let attempts = 0;
    let emptyCount = 0;
    let errorCount = 0;
    let retry;
    const loader = loadData(async () => {
      attempts++;
      if (attempts === 1) throw new Error("Offline");
      return [];
    }, [], {
      container,
      loading: () => {},
      empty: () => { emptyCount++; },
      error: (_container, _error, retryRequest) => { errorCount++; retry = retryRequest; },
    });

    await loader.load();
    assert.equal(errorCount, 1);
    await retry();
    assert.equal(emptyCount, 1);
    assert.equal(attempts, 2);
    loader.destroy();
  } finally {
    if (previousHTMLElement === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = previousHTMLElement;
  }
});
