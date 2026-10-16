import { NOMINATIM_VIEWBOX } from "./config.js";
import { BARANGAY_NAMES } from "./barangays.js";

export async function nominatimSearch(query, signal) {
  const term = String(query ?? "").trim();
  if (term.length < 2) return [];
  const params = new URLSearchParams({
    q: term, format: "jsonv2", countrycodes: "ph", viewbox: NOMINATIM_VIEWBOX, bounded: "1", limit: "6",
  });
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      signal, headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Search unavailable (${response.status})`);
    const records = await response.json();
    if (!Array.isArray(records)) throw new TypeError("Nominatim returned an invalid result.");
    return records.map((record) => ({
      id: `osm-${record.place_id}`,
      name: String(record.display_name ?? ""),
      lat: Number(record.lat),
      lng: Number(record.lon),
    })).filter((item) => item.name && Number.isFinite(item.lat) && Number.isFinite(item.lng));
  } catch (error) {
    if (signal?.aborted) throw error;
    const needle = term.toLocaleLowerCase();
    return BARANGAY_NAMES.filter((name) => name.toLocaleLowerCase().includes(needle))
      .map((name, index) => ({ id: `barangay-${index}`, name, lat: null, lng: null, fallback: true }));
  }
}
