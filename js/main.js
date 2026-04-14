
const map = L.map('map').setView([37.34, -121.90], 12);
const statusEl = document.getElementById('status');
const legendEl = document.getElementById('legend');
const locateBtn = document.getElementById('locateBtn');
const toggleLegendBtn = document.getElementById('toggleLegend');

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const colorScale = d3.scaleThreshold()
  .domain([35, 60])
  .range(['#facc15', '#22c55e', '#1d4ed8']);

const state = {
  selectedId: null,
  lookup: new Map(),
  geojsonLayer: null
};

Promise.all([
  d3.json('data/service_areas.geojson'),
  d3.csv('data/service_values.csv', d => ({ ...d, value: +d.value }))
]).then(([geoData, data]) => {
  data.forEach(d => state.lookup.set(d.id, d));
  geoData.features.forEach(feature => {
    const match = state.lookup.get(String(feature.properties.id));
    feature.properties.value = match ? match.value : 0;
    feature.properties.label = match ? match.label : feature.properties.name;
  });
  drawMap(geoData);
  drawChart(data);
});

function drawMap(geoData) {
  state.geojsonLayer = L.geoJSON(geoData, {
    style: feature => ({
      color: feature.properties.id === state.selectedId ? '#f59e0b' : '#334155',
      weight: feature.properties.id === state.selectedId ? 3 : 1,
      fillColor: colorScale(feature.properties.value),
      fillOpacity: 0.78
    }),
    onEachFeature(feature, layer) {
      layer.bindPopup(`<strong>${feature.properties.label}</strong><br>Service value: ${feature.properties.value}`);
      layer.on('click', () => selectRegion(feature.properties.id));
    }
  }).addTo(map);

  map.fitBounds(state.geojsonLayer.getBounds(), { padding: [20, 20] });
}

function drawChart(data) {
  const svg = d3.select('#chart');
  const width = 560;
  const height = 320;
  const margin = { top: 20, right: 20, bottom: 70, left: 55 };

  const x = d3.scaleBand()
    .domain(data.map(d => d.label))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value)]).nice()
    .range([height - margin.bottom, margin.top]);

  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('transform', 'rotate(-25)')
    .style('text-anchor', 'end');

  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.selectAll('.bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => x(d.label))
    .attr('y', d => y(d.value))
    .attr('width', x.bandwidth())
    .attr('height', d => height - margin.bottom - y(d.value))
    .on('click', (_, d) => selectRegion(d.id));
}

function selectRegion(id) {
  state.selectedId = id;
  state.geojsonLayer.eachLayer(layer => {
    const feature = layer.feature;
    const isActive = feature.properties.id === id;
    layer.setStyle({
      color: isActive ? '#f59e0b' : '#334155',
      weight: isActive ? 3 : 1,
      fillColor: colorScale(feature.properties.value),
      fillOpacity: 0.78
    });
    if (isActive) {
      layer.openPopup();
      statusEl.textContent = `Status: ${feature.properties.label} selected.`;
    }
  });

  d3.selectAll('.bar').classed('active', d => d.id === id);
}

locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    statusEl.textContent = 'Status: Geolocation is not supported in this browser.';
    return;
  }

  statusEl.textContent = 'Status: Locating the device...';
  navigator.geolocation.getCurrentPosition(position => {
    const { latitude, longitude } = position.coords;
    L.circleMarker([latitude, longitude], {
      radius: 9,
      color: '#0f172a',
      fillColor: '#38bdf8',
      fillOpacity: 0.95
    }).addTo(map).bindPopup('Current location').openPopup();
    map.setView([latitude, longitude], 13);
    statusEl.textContent = `Status: Centered on ${latitude.toFixed(4)}, ${longitude.toFixed(4)}.`;
  }, () => {
    statusEl.textContent = 'Status: Location request was denied or unavailable.';
  });
});

toggleLegendBtn.addEventListener('click', () => {
  legendEl.classList.toggle('hidden-mobile');
});


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(() => {
        const current = statusEl.textContent;
        statusEl.textContent = `${current} Service worker registered.`;
      })
      .catch(() => {
        statusEl.textContent = 'Status: Service worker registration failed.';
      });
  });
}
