import { loadLeaflet } from "./map-view.js";

export async function createLocationPicker(map, { initialPoint = null, onChange = () => {}, enabled = true } = {}) {
  const L = await loadLeaflet();
  const markers = L.layerGroup().addTo(map);
  let marker = null;
  let point = initialPoint ? [Number(initialPoint[0]), Number(initialPoint[1])] : null;
  let active = Boolean(enabled);
  const showPoint = (nextPoint) => {
    point = nextPoint;
    markers.clearLayers();
    if (point) marker = L.marker(point, { title: "Selected location", draggable: true }).addTo(markers);
    if (marker) marker.on("dragend", () => {
      const position = marker.getLatLng();
      point = [position.lat, position.lng];
      onChange([...point]);
    });
    onChange(point ? [...point] : null);
  };
  const onClick = (event) => {
    if (active) showPoint([event.latlng.lat, event.latlng.lng]);
  };
  map.on("click", onClick);
  if (point) showPoint(point);
  return {
    getPoint: () => point ? [...point] : null,
    setEnabled(value) { active = Boolean(value); },
    setPoint(nextPoint) {
      if (nextPoint === null) { point = null; markers.clearLayers(); marker = null; onChange(null); return; }
      if (!Array.isArray(nextPoint) || nextPoint.length !== 2 || !nextPoint.every((value) => Number.isFinite(Number(value)))) {
        throw new TypeError("A selected map point must contain latitude and longitude numbers.");
      }
      showPoint([Number(nextPoint[0]), Number(nextPoint[1])]);
    },
    destroy() { map.off("click", onClick); markers.remove(); },
  };
}
