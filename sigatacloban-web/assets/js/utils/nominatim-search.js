import { nominatimSearch } from "../api/nominatim.js";

export function createNominatimSearch({ delay = 320, onResults = () => {}, onLoading = () => {}, onError = () => {} } = {}) {
  let timer = 0;
  let controller = null;
  let latestRequest = 0;
  const search = (query) => {
    window.clearTimeout(timer);
    controller?.abort();
    const requestId = ++latestRequest;
    const term = String(query ?? "").trim();
    if (term.length < 2) {
      onResults([]);
      onLoading(false);
      return;
    }
    timer = window.setTimeout(async () => {
      controller = new AbortController();
      onLoading(true);
      try {
        const results = await nominatimSearch(term, controller.signal);
        if (requestId === latestRequest) onResults(results);
      } catch (error) {
        if (!controller.signal.aborted && requestId === latestRequest) {
          onError(error);
          onResults([]);
        }
      } finally {
        if (requestId === latestRequest) onLoading(false);
      }
    }, delay);
  };
  return {
    search,
    cancel() {
      window.clearTimeout(timer);
      controller?.abort();
      latestRequest += 1;
      onLoading(false);
    },
  };
}
