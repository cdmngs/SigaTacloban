import { escapeHtml } from "../utils/dom.js";
import { loadLeaflet } from "./map-view.js";

const riskColors = Object.freeze({ low: "#2E9E5B", moderate: "#F4C430", high: "#F77F00", veryhigh: "#D62828" });

export async function addMapLayers(map, {
  areas = [], incidents = [], hotspots = [], stations = [], coverageRingMinutes = null,
  selectedAreaId = null, onSelectArea, onSelectIncident, onSelectStation, visibility = {}, mode = "risk",
} = {}) {
  const L = await loadLeaflet();
  const layers = {
    riskZones: L.layerGroup(),
    incidents: L.layerGroup(),
    hotspots: L.layerGroup(),
    fireStations: L.layerGroup(),
  };
  const enabled = { riskZones: true, incidents: true, hotspots: true, fireStations: true, ...visibility };
  const areaPaths = [];
  const stationPoints = [];
  const stationRings = [];

  for (const area of areas) {
    if (!area.geometry) continue;
    const color = riskColors[area.level] || "#6E5B52";
    const geometry = L.geoJSON(area.geometry, {
      style: {
        color: area.id === selectedAreaId ? "#220901" : color,
        weight: area.id === selectedAreaId ? 2.5 : 1.5,
        opacity: 0.8,
        fillColor: color,
        fillOpacity: 0.42,
        className: "risk-zone-path",
      },
      onEachFeature: (_feature, layer) => {
        layer.on("click", () => onSelectArea?.(area.id));
        layer.bindPopup(`<b>${escapeHtml(area.name)}</b><br>Risk score: ${Number(area.score) || 0}`);
      },
    }).addTo(layers.riskZones);
    areaPaths.push({ geometry, color, selected: area.id === selectedAreaId });
    const label = L.divIcon({
      className: `risk-score-marker${area.id === selectedAreaId ? " is-selected" : ""}`,
      html: `<span style="--marker-risk:${color}">${Number(area.score) || 0}</span>`,
      iconSize: [42, 42], iconAnchor: [21, 21],
    });
    L.marker(area.center, { icon: label, title: String(area.name ?? "") })
      .on("click", () => onSelectArea?.(area.id))
      .addTo(layers.riskZones);
  }

  const incidentCluster = typeof L.markerClusterGroup === "function"
    ? L.markerClusterGroup({ chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 68, disableClusteringAtZoom: 15, spiderfyOnMaxZoom: true })
    : L.layerGroup();
  for (const incident of incidents) {
    if (!Number.isFinite(Number(incident.lat)) || !Number.isFinite(Number(incident.lng))) continue;
    const marker = L.marker([Number(incident.lat), Number(incident.lng)], { title: String(incident.id ?? "Fire incident") })
      .bindPopup(`<div class="incident-popup"><b>${escapeHtml(incident.id)}</b><span>${escapeHtml(incident.class ?? incident.fireClass)}</span><small>${escapeHtml(incident.date)} · ${escapeHtml(incident.time)}</small></div>`)
      .on("click", () => onSelectIncident?.(incident.id));
    incidentCluster.addLayer(marker);
  }
  layers.incidents.addLayer(incidentCluster);

  for (const hotspot of hotspots) {
    if (!Number.isFinite(Number(hotspot.lat)) || !Number.isFinite(Number(hotspot.lng))) continue;
    L.circle([Number(hotspot.lat), Number(hotspot.lng)], {
      radius: 110 + Math.max(0, Math.min(100, Number(hotspot.score) || 0)) * 2,
      color: riskColors.veryhigh, weight: 0, fillColor: riskColors.high, fillOpacity: 0.2,
      className: "hotspot-marker",
    }).addTo(layers.hotspots);
  }

  for (const station of stations) {
    if (!Number.isFinite(Number(station.lat)) || !Number.isFinite(Number(station.lng))) continue;
    const point = [Number(station.lat), Number(station.lng)];
    stationPoints.push({ point, radius: Number(station.coverageRadiusMeters) });
    const icon = L.divIcon({
      className: "station-marker",
      html: '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20 6v5.8c0 4.9-3.4 8.2-8 10.2-4.6-2-8-5.3-8-10.2V6l8-3.5Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg></span>',
      iconSize: [28, 34], iconAnchor: [14, 17],
    });
    L.marker(point, { icon, title: String(station.name ?? "") })
      .bindPopup(`<div class="station-popup"><b>${escapeHtml(station.name)}</b><span>${escapeHtml(station.address ?? station.barangay ?? "")}</span></div>`)
      .on("click", () => onSelectStation?.(station))
      .addTo(layers.fireStations);
  }
  const drawStationRings = (minutes) => {
    for (const ring of stationRings.splice(0)) layers.fireStations.removeLayer(ring);
    const selectedRings = Array.isArray(minutes) ? minutes : null;
    for (const station of stationPoints) {
      if (selectedRings !== null) {
        for (const value of selectedRings) {
          const color = value <= 5 ? riskColors.low : value <= 10 ? riskColors.moderate : riskColors.high;
          const ring = L.circle(station.point, { radius: Number(value) * 280, color, weight: 1, opacity: 0.58, fillOpacity: 0 }).addTo(layers.fireStations);
          stationRings.push(ring);
        }
      } else if (Number.isFinite(station.radius)) {
        const ring = L.circle(station.point, { radius: station.radius, color: riskColors.low, weight: 1, opacity: 0.5, fillColor: riskColors.low, fillOpacity: mode === "stations" ? 0.15 : 0.075 }).addTo(layers.fireStations);
        stationRings.push(ring);
      }
    }
  };
  drawStationRings(coverageRingMinutes);

  for (const [key, layer] of Object.entries(layers)) if (enabled[key]) layer.addTo(map);
  return {
    groups: layers,
    setVisibility(key, visible) {
      const layer = layers[key];
      if (!layer) throw new RangeError(`Unknown map layer: ${key}`);
      if (visible && !map.hasLayer(layer)) layer.addTo(map);
      if (!visible && map.hasLayer(layer)) map.removeLayer(layer);
    },
    setCoverageRings(minutes) {
      if (minutes !== null && (!Array.isArray(minutes) || !minutes.every((value) => [5, 10, 15].includes(Number(value))))) {
        throw new TypeError("Coverage rings must be selected from 5, 10, and 15 minutes.");
      }
      drawStationRings(minutes);
    },
    setMode(nextMode) {
      if (!["risk", "hotspots", "stations"].includes(nextMode)) throw new RangeError(`Unknown map mode: ${nextMode}`);
      mode = nextMode;
      for (const { geometry, color, selected } of areaPaths) {
        geometry.setStyle({ fillOpacity: mode === "risk" ? 0.42 : 0.2, color: selected ? "#220901" : color });
      }
      if (!Array.isArray(coverageRingMinutes)) drawStationRings(null);
    },
    destroy() {
      for (const layer of Object.values(layers)) map.removeLayer(layer);
    },
  };
}
