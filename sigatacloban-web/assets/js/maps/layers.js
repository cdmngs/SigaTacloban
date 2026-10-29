import { escapeHtml } from "../utils/dom.js";
import { formatNumber, formatValue } from "../utils/format.js";
import { loadLeaflet } from "./map-view.js";
import { RISK_COLORS, riskColorForLevel } from "../utils/risk.js";

const riskColors = RISK_COLORS;
const riskColor = riskColorForLevel;
const isCoordinate = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

export async function addMapLayers(map, {
  areas = [], incidents = [], hotspots = [], stations = [], coverageRingMinutes = null, coverageRings = null,
  selectedAreaId = null, onSelectArea, onSelectIncident, onSelectStation, visibility = {}, mode = "risk",
} = {}) {
  const L = await loadLeaflet();
  const groups = {
    riskZones: L.layerGroup(),
    incidents: L.layerGroup(),
    hotspots: L.layerGroup(),
    fireStations: L.layerGroup(),
  };
  const coverageRingLayer = L.layerGroup().addTo(map);
  const enabled = { riskZones: true, incidents: true, hotspots: true, fireStations: true, ...visibility };
  const areaPaths = [];
  let areaRecords = areas;
  let incidentRecords = incidents;
  let hotspotRecords = hotspots;
  let stationRecords = stations;
  let selectedId = selectedAreaId;
  let selectedRings = coverageRingMinutes;
  let ringFeatures = coverageRings?.type === "FeatureCollection" ? coverageRings.features || [] : [];
  let currentMode = mode;
  const applyVisibility = () => {
    const modeLayers = {
      risk: ["riskZones", "incidents"],
      hotspots: ["hotspots"],
      stations: ["fireStations"],
    }[currentMode];
    for (const [key, layer] of Object.entries(groups)) {
      const shouldShow = enabled[key] && modeLayers.includes(key);
      if (shouldShow && !map.hasLayer(layer)) layer.addTo(map);
      if (!shouldShow && map.hasLayer(layer)) map.removeLayer(layer);
    }
  };

  function drawAreas() {
    groups.riskZones.clearLayers();
    areaPaths.length = 0;
    for (const area of areaRecords) {
      if (!area.geometry) continue;
      const color = riskColor(area.riskLevel || area.level);
      const selected = area.id === selectedId;
      const geometry = L.geoJSON(area.geometry, {
        style: {
          color: selected ? "#220901" : color,
          weight: selected ? 2.5 : 1.5,
          opacity: 0.8,
          fillColor: color,
          fillOpacity: mode === "risk" ? 0.42 : 0.2,
          className: "risk-zone-path",
        },
        onEachFeature: (_feature, layer) => {
          layer.on("click", () => onSelectArea?.(area.id));
          layer.bindPopup(`<b>${escapeHtml(formatValue(area.name))}</b><br>Risk score: ${escapeHtml(formatNumber(area.riskScore ?? area.score))}`);
        },
      }).addTo(groups.riskZones);
      areaPaths.push({ geometry, color, selected });
      if ((Array.isArray(area.center) && area.center.length >= 2 && area.center.every(isCoordinate))
        || (isCoordinate(area.center?.lat) && isCoordinate(area.center?.lng))) {
        const center = Array.isArray(area.center) ? area.center : [area.center.lat, area.center.lng];
        const score = formatNumber(area.riskScore ?? area.score);
        const label = L.divIcon({
          className: `risk-score-marker${selected ? " is-selected" : ""}`,
          html: `<span style="--marker-risk:${color}">${escapeHtml(score)}</span>`,
          iconSize: [42, 42], iconAnchor: [21, 21],
        });
        L.marker(center, { icon: label, title: formatValue(area.name) })
          .on("click", () => onSelectArea?.(area.id))
          .addTo(groups.riskZones);
      }
    }
  }

  function drawIncidents() {
    groups.incidents.clearLayers();
    const cluster = typeof L.markerClusterGroup === "function"
      ? L.markerClusterGroup({ chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 68, disableClusteringAtZoom: 15, spiderfyOnMaxZoom: true })
      : L.layerGroup();
    for (const incident of incidentRecords) {
      if (!isCoordinate(incident.lat) || !isCoordinate(incident.lng)) continue;
      const marker = L.marker([Number(incident.lat), Number(incident.lng)], { title: formatValue(incident.id) })
        .bindPopup(`<div class="incident-popup"><b>${escapeHtml(formatValue(incident.id))}</b><span>${escapeHtml(formatValue(incident.class ?? incident.fireClass))}</span><small>${escapeHtml(formatValue(incident.date))} · ${escapeHtml(formatValue(incident.time))}</small></div>`)
        .on("click", () => onSelectIncident?.(incident.id));
      cluster.addLayer(marker);
    }
    groups.incidents.addLayer(cluster);
  }

  function drawHotspots() {
    groups.hotspots.clearLayers();
    for (const hotspot of hotspotRecords) {
      if (!isCoordinate(hotspot.lat) || !isCoordinate(hotspot.lng)) continue;
      const score = Number(hotspot.riskScore ?? hotspot.score);
      const radius = Number.isFinite(score) ? 110 + Math.max(0, Math.min(100, score)) * 2 : 110;
      L.circle([Number(hotspot.lat), Number(hotspot.lng)], {
        radius, color: riskColors.veryhigh, weight: 0, fillColor: riskColors.high, fillOpacity: 0.2,
        className: "hotspot-marker",
      }).addTo(groups.hotspots);
    }
  }

  function drawStations() {
    groups.fireStations.clearLayers();
    const stationPoints = [];
    for (const station of stationRecords) {
      if (!isCoordinate(station.lat) || !isCoordinate(station.lng)) continue;
      const point = [Number(station.lat), Number(station.lng)];
      const radius = station.coverageRadiusMeters === null || station.coverageRadiusMeters === undefined
        ? Number.NaN
        : Number(station.coverageRadiusMeters);
      stationPoints.push({ point, radius });
      const icon = L.divIcon({
        className: "station-marker",
        html: '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20 6v5.8c0 4.9-3.4 8.2-8 10.2-4.6-2-8-5.3-8-10.2V6l8-3.5Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg></span>',
        iconSize: [28, 34], iconAnchor: [14, 17],
      });
      L.marker(point, { icon, title: formatValue(station.name) })
        .bindPopup(`<div class="station-popup"><b>${escapeHtml(formatValue(station.name))}</b><span>${escapeHtml(formatValue(station.address ?? station.barangay))}</span></div>`)
        .on("click", () => onSelectStation?.(station))
        .addTo(groups.fireStations);
    }
    drawStationRings(stationPoints);
  }

  function drawStationRings(stationPoints = stationRecords
    .filter((station) => isCoordinate(station.lat) && isCoordinate(station.lng))
    .map((station) => ({
      point: [Number(station.lat), Number(station.lng)],
      radius: station.coverageRadiusMeters === null || station.coverageRadiusMeters === undefined ? Number.NaN : Number(station.coverageRadiusMeters),
    }))) {
    const minutes = Array.isArray(selectedRings) ? selectedRings : null;
    for (const station of stationPoints) {
      if (minutes !== null) {
        continue;
      } else if (Number.isFinite(station.radius)) {
        L.circle(station.point, {
          radius: station.radius, color: riskColors.low, weight: 1, opacity: 0.5,
          fillColor: riskColors.low, fillOpacity: mode === "stations" ? 0.15 : 0.075,
        }).addTo(groups.fireStations);
      }
    }
  }

  function drawCoverageRings() {
    coverageRingLayer.clearLayers();
    const selected = new Set((selectedRings || []).map(Number));
    if (!selected.size) return;
    const colors = { 5: riskColors.low, 10: riskColors.moderate, 15: riskColors.high };
    const features = ringFeatures.filter((feature) => selected.has(Number(feature.properties?.minutes))
      && Array.isArray(feature.geometry?.coordinates) && feature.geometry.coordinates.length > 0);
    if (features.length) {
      L.geoJSON({ type: "FeatureCollection", features }, {
        style: (feature) => {
          const color = colors[Number(feature.properties?.minutes)] || riskColors.low;
          return { color, weight: 1.5, opacity: 0.65, fillColor: color, fillOpacity: 0.08 };
        },
      }).addTo(coverageRingLayer);
    } else {
      for (const station of stationRecords) {
        if (!isCoordinate(station.lat) || !isCoordinate(station.lng)) continue;
        for (const minute of selected) {
          const color = colors[minute] || riskColors.low;
          L.circle([Number(station.lat), Number(station.lng)], {
            radius: minute * 280, color, weight: 1, opacity: 0.58, fillOpacity: 0,
          }).addTo(coverageRingLayer);
        }
      }
    }
  }

  drawAreas();
  drawIncidents();
  drawHotspots();
  drawStations();
  applyVisibility();
  drawCoverageRings();

  function setVisibility(key, visible) {
    const layer = groups[key];
    if (!layer) throw new RangeError(`Unknown map layer: ${key}`);
    enabled[key] = Boolean(visible);
    applyVisibility();
  }

  return {
    groups,
    setVisibility,
    updateData(nextData = {}) {
      const keys = new Set();
      if (Object.hasOwn(nextData, "areas")) { areaRecords = nextData.areas || []; keys.add("riskZones"); }
      if (Object.hasOwn(nextData, "incidents")) { incidentRecords = nextData.incidents || []; keys.add("incidents"); }
      if (Object.hasOwn(nextData, "hotspots")) { hotspotRecords = nextData.hotspots || []; keys.add("hotspots"); }
      if (Object.hasOwn(nextData, "stations")) { stationRecords = nextData.stations || []; keys.add("fireStations"); }
      if (Object.hasOwn(nextData, "coverageRings")) {
        ringFeatures = nextData.coverageRings?.features || [];
        drawCoverageRings();
      }
      if (Object.hasOwn(nextData, "selectedAreaId")) { selectedId = nextData.selectedAreaId; keys.add("riskZones"); }
      for (const key of keys) {
        if (key === "riskZones") drawAreas();
        else if (key === "incidents") drawIncidents();
        else if (key === "hotspots") drawHotspots();
        else drawStations();
      }
    },
    setCoverageRings(minutes) {
      if (minutes !== null && (!Array.isArray(minutes) || !minutes.every((value) => [5, 10, 15].includes(Number(value))))) {
        throw new TypeError("Coverage rings must be selected from 5, 10, and 15 minutes.");
      }
      selectedRings = minutes;
      drawCoverageRings();
      drawStations();
    },
    setMode(nextMode) {
      if (!["risk", "hotspots", "stations"].includes(nextMode)) throw new RangeError(`Unknown map mode: ${nextMode}`);
      mode = nextMode;
      currentMode = nextMode;
      applyVisibility();
      for (const { geometry, color, selected } of areaPaths) {
        geometry.setStyle({ fillOpacity: mode === "risk" ? 0.42 : 0.2, color: selected ? "#220901" : color });
      }
      if (!Array.isArray(selectedRings)) drawStations();
    },
    invalidateSize() {
      map.invalidateSize({ animate: false, pan: false, debounceMoveend: true });
    },
    destroy() {
      for (const layer of Object.values(groups)) map.removeLayer(layer);
      map.removeLayer(coverageRingLayer);
    },
  };
}
