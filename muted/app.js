(function () {
  const lineData = window.HEFEI_METRO_LINES;
  const stationData = window.HEFEI_METRO_STATIONS;

  const map = L.map("map", {
    zoomControl: false,
    preferCanvas: true,
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const lineLayers = new Map();
  const lineLabels = new Map();
  const stationMarkers = [];
  const stationLabels = [];
  const allBounds = L.latLngBounds([]);
  let labelsVisible = true;
  const stationLabelMinZoom = 12;
  let highlightedStation = null;

  function asColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
  }

  function midpointOfGeometry(geometry) {
    const coords =
      geometry.type === "MultiLineString"
        ? geometry.coordinates.flat()
        : geometry.coordinates;
    const index = Math.floor(coords.length / 2);
    return [coords[index][1], coords[index][0]];
  }

  function stationPopup(properties) {
    const name = properties.name || "未命名站点";
    const lon = Number(properties.lon).toFixed(6);
    const lat = Number(properties.lat).toFixed(6);
    return `<div class="popup-title">${name}</div><div class="popup-meta">经度 ${lon}<br>纬度 ${lat}</div>`;
  }

  lineData.features.forEach((feature) => {
    const properties = feature.properties || {};
    const lineRef = String(properties.line_ref || "");
    const color = asColor(properties.colour, "#334155");
    const haloLayer = L.geoJSON(feature, {
      interactive: false,
      style: {
        color: "#ffffff",
        weight: 12,
        opacity: 0.94,
        lineCap: "round",
        lineJoin: "round",
      },
    }).addTo(map);

    const layer = L.geoJSON(feature, {
      style: {
        color,
        weight: 7,
        opacity: 0.98,
        lineCap: "round",
        lineJoin: "round",
      },
    }).bindPopup(
      `<div class="popup-title">${properties.line_name || `合肥轨道交通${lineRef}号线`}</div>` +
        `<div class="popup-meta">${properties.way_count || ""} 个线段来源</div>`,
    );

    layer.addTo(map);
    allBounds.extend(layer.getBounds());
    lineLayers.set(lineRef, { halo: haloLayer, color: layer });

    const label = L.marker(midpointOfGeometry(feature.geometry), {
      interactive: false,
      icon: L.divIcon({
        className: "line-label",
        html: `<span style="background:${color}">${lineRef}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    }).addTo(map);
    lineLabels.set(lineRef, label);
  });

  stationData.features.forEach((feature) => {
    const properties = feature.properties || {};
    const coords = feature.geometry.coordinates;
    const latLng = [coords[1], coords[0]];
    const marker = L.marker(latLng, {
      title: properties.name || "",
      icon: L.divIcon({
        className: "station-marker",
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      }),
    }).bindPopup(stationPopup(properties));

    marker.stationName = properties.name || "";
    marker.addTo(map);
    stationMarkers.push(marker);

    const label = L.marker(latLng, {
      interactive: false,
      icon: L.divIcon({
        className: "station-label",
        html: `<span>${properties.name || ""}</span>`,
        iconAnchor: [-8, 18],
      }),
    }).addTo(map);
    stationLabels.push(label);
    allBounds.extend(latLng);
  });

  map.fitBounds(allBounds.pad(0.08));

  const filters = document.getElementById("line-filters");
  [...lineLayers.keys()]
    .sort((a, b) => Number(a) - Number(b))
    .forEach((lineRef) => {
      const color = asColor(lineData.features.find((f) => String(f.properties.line_ref) === lineRef)?.properties.colour, "#334155");
      const label = document.createElement("label");
      label.className = "line-filter";
      label.innerHTML = `
        <input type="checkbox" value="${lineRef}" checked>
        <span class="swatch" style="background:${color}"></span>
        <span>${lineRef}号线</span>
      `;
      label.querySelector("input").addEventListener("change", (event) => {
        const checked = event.target.checked;
        const layerSet = lineLayers.get(lineRef);
        const lineLabel = lineLabels.get(lineRef);
        if (checked) {
          layerSet.halo.addTo(map);
          layerSet.color.addTo(map);
          lineLabel.addTo(map);
        } else {
          layerSet.halo.remove();
          layerSet.color.remove();
          lineLabel.remove();
        }
      });
      filters.append(label);
    });

  document.getElementById("fit-map").addEventListener("click", () => {
    map.fitBounds(allBounds.pad(0.08));
  });

  document.getElementById("toggle-labels").addEventListener("click", (event) => {
    labelsVisible = !labelsVisible;
    event.currentTarget.setAttribute("aria-pressed", String(labelsVisible));
    updateStationLabels();
  });

  function updateStationLabels() {
    const shouldShow = labelsVisible && map.getZoom() >= stationLabelMinZoom;
    stationLabels.forEach((label) => {
      if (shouldShow) {
        label.addTo(map);
      } else {
        label.remove();
      }
    });
  }

  map.on("zoomend", updateStationLabels);
  updateStationLabels();

  document.getElementById("station-search").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    if (highlightedStation) {
      highlightedStation.getElement()?.classList.remove("highlight");
      highlightedStation = null;
    }
    if (!query) return;
    const match = stationMarkers.find((marker) =>
      marker.stationName.toLowerCase().includes(query),
    );
    if (!match) return;
    map.setView(match.getLatLng(), Math.max(map.getZoom(), 14), { animate: true });
    match.openPopup();
    highlightedStation = match;
    setTimeout(() => match.getElement()?.classList.add("highlight"), 180);
  });
})();
