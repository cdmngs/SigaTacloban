const cache = new Map();

export function createQuery(key, queryFn, { staleTime = 0, enabled = true } = {}) {
  if (typeof queryFn !== "function") throw new TypeError("A query function is required.");
  const cacheKey = JSON.stringify(key);
  let entry = cache.get(cacheKey);
  if (!entry) {
    entry = { data: undefined, error: null, loading: false, updatedAt: 0, promise: null, listeners: new Set() };
    cache.set(cacheKey, entry);
  }
  const notify = () => entry.listeners.forEach((listener) => listener(query.snapshot));
  const refetch = async () => {
    if (entry.promise) return entry.promise;
    entry.loading = true;
    entry.error = null;
    notify();
    const promise = Promise.resolve().then(queryFn).then((data) => {
      entry.data = data;
      entry.updatedAt = Date.now();
      return data;
    }).catch((error) => {
      entry.error = error;
      throw error;
    }).finally(() => {
      entry.loading = false;
      entry.promise = null;
      notify();
    });
    entry.promise = promise;
    return promise;
  };
  const query = {
    get snapshot() {
      return { loading: entry.loading, error: entry.error, data: entry.data, refetch };
    },
    get loading() { return entry.loading; },
    get error() { return entry.error; },
    get data() { return entry.data; },
    refetch,
    subscribe(listener) {
      entry.listeners.add(listener);
      return () => entry.listeners.delete(listener);
    },
    destroy() {
      entry.listeners.clear();
    },
  };
  if (enabled && (!entry.updatedAt || Date.now() - entry.updatedAt >= staleTime)) {
    void refetch().catch(() => {});
  }
  return query;
}

export function clearQueryCache() {
  cache.clear();
}
