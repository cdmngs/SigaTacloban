import { MAP_BOUNDS, MAP_CENTER } from "../api/config.js";

const scriptPromises = new Map();
const activeMapCleanup = new Set();
let mapCleanupOnPageHideRegistered = false;
const addStylesheet = (href, id) => {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
};

function loadScript(src, id) {
  if (window.L && id === "vendor-leaflet") return Promise.resolve(window.L);
  if (id === "vendor-markercluster" && window.L?.markerClusterGroup) return Promise.resolve(window.L);
  if (scriptPromises.has(id)) return scriptPromises.get(id);
  const promise = new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing?.dataset.loaded === "true") { resolve(window.L); return; }
    const script = existing || document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(window.L); }, { once: true });
    script.addEventListener("error", () => { scriptPromises.delete(id); reject(new Error(`Could not load local map library: ${src}`)); }, { once: true });
    if (!existing) document.head.append(script);
  });
  scriptPromises.set(id, promise);
  return promise;
}

export async function loadLeaflet() {
  addStylesheet("assets/css/maps.css", "site-map-css");
  addStylesheet("assets/vendor/leaflet.css", "vendor-leaflet-css");
  addStylesheet("assets/vendor/MarkerCluster.css", "vendor-markercluster-css");
  addStylesheet("assets/vendor/MarkerCluster.Default.css", "vendor-markercluster-default-css");
  const leaflet = await loadScript("assets/vendor/leaflet.js", "vendor-leaflet");
  if (!leaflet) throw new Error("Leaflet did not initialize.");
  await loadScript("assets/vendor/leaflet.markercluster.js", "vendor-markercluster");
  delete leaflet.Icon.Default.prototype._getIconUrl;
  leaflet.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL("assets/vendor/images/marker-icon-2x.png", document.baseURI).href,
    iconUrl: new URL("assets/vendor/images/marker-icon.png", document.baseURI).href,
    shadowUrl: new URL("assets/vendor/images/marker-shadow.png", document.baseURI).href,
  });
  return leaflet;
}

export async function createMap(container, { interactive = true, zoom = 12.1, tileLayer = true, onTilesReady } = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError("A map container element is required.");
  const L = await loadLeaflet();
  container.style.position = "relative";
  container.style.zIndex = "0";
  container.style.isolation = "isolate";
  container.classList.add("sigatacloban-map");
  const cityBounds = L.latLngBounds(MAP_BOUNDS[0], MAP_BOUNDS[1]);
  const map = L.map(container, {
    center: MAP_CENTER, zoom, minZoom: 10, maxZoom: 16, maxBounds: cityBounds,
    maxBoundsViscosity: 0.82, zoomControl: false, scrollWheelZoom: interactive,
    boxZoom: interactive,
    dragging: interactive, doubleClickZoom: interactive, touchZoom: interactive,
    keyboard: interactive, preferCanvas: true,
  });
  container.classList.toggle("sigatacloban-map-static", !interactive);
  if (tileLayer) {
    const tilesReady = typeof onTilesReady === "function" ? onTilesReady : () => {};
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map).on("load", tilesReady).on("tileerror", tilesReady);
  }
  const invalidate = () => map.invalidateSize({ animate: false, pan: false, debounceMoveend: true });
  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(invalidate) : null;
  resizeObserver?.observe(container);
  window.addEventListener("resize", invalidate);
  requestAnimationFrame(invalidate);
  const destroy = () => {
    if (!activeMapCleanup.has(destroy)) return;
    activeMapCleanup.delete(destroy);
    resizeObserver?.disconnect();
    window.removeEventListener("resize", invalidate);
    map.remove();
  };
  activeMapCleanup.add(destroy);
  if (!mapCleanupOnPageHideRegistered) {
    mapCleanupOnPageHideRegistered = true;
    window.addEventListener("pagehide", () => {
      for (const cleanup of [...activeMapCleanup]) cleanup();
    }, { once: true });
  }
  return {
    map,
    L,
    destroy,
  };
}
