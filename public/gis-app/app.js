/* ================================================
   GIS وادي مزاب — المسح العقاري
   Main Application Logic
   ================================================ */

// ─── Commune Name Mapping ───
const COMMUNE_NAMES = {
  '4701': 'غرداية',
  '4703': 'بني يزقن',
  '4705': 'العطف',
  '4706': 'بونورة',
  '4707': 'الغريرة',
  '4708': 'بريان',
  '4710': 'المنيعة',
  '47010': 'متليلي',
  'مجهول': 'غير محددة'
};

// ─── Color Palette for Communes ───
const COMMUNE_COLORS = {
  '4701': { fill: 'rgba(0, 229, 255, 0.12)', stroke: '#00e5ff' },
  '4703': { fill: 'rgba(124, 58, 237, 0.12)', stroke: '#7c3aed' },
  '4705': { fill: 'rgba(245, 158, 11, 0.12)', stroke: '#f59e0b' },
  '4706': { fill: 'rgba(16, 185, 129, 0.12)', stroke: '#10b981' },
  '4707': { fill: 'rgba(236, 72, 153, 0.12)', stroke: '#ec4899' },
  '4708': { fill: 'rgba(59, 130, 246, 0.12)', stroke: '#3b82f6' },
  '4710': { fill: 'rgba(168, 85, 247, 0.12)', stroke: '#a855f7' },
  '47010': { fill: 'rgba(20, 184, 166, 0.12)', stroke: '#14b8a6' },
  'مجهول': { fill: 'rgba(100, 116, 139, 0.12)', stroke: '#64748b' }
};

// ─── Global State ───
let map;
let allFeatures = [];
let communeIndex = {};      // { commune: [featureIndices] }
let displayedLayer = null;
let selectedFeature = null;
let selectedLayer = null;
let currentFilters = { commune: '', section: '', ilot: '' };
let labelsVisible = false;
let labelLayerGroup = null;

// ─── DOM Elements ───
const els = {};

// ─── Initialization ───
document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  initMap();
  bindEvents();
  loadGeoJSON();
});

function cacheElements() {
  els.loadingOverlay = document.getElementById('loadingOverlay');
  els.progressFill = document.getElementById('progressFill');
  els.loadingStats = document.getElementById('loadingStats');
  els.communeSelect = document.getElementById('communeSelect');
  els.sectionInput = document.getElementById('sectionInput');
  els.ilotInput = document.getElementById('ilotInput');
  els.searchBtn = document.getElementById('searchBtn');
  els.resetBtn = document.getElementById('resetBtn');
  els.sidebar = document.getElementById('sidebar');
  els.sidebarToggle = document.getElementById('sidebarToggle');
  els.detailPanel = document.getElementById('detailPanel');
  els.detailBody = document.getElementById('detailBody');
  els.detailClose = document.getElementById('detailClose');
  els.exportBtn = document.getElementById('exportBtn');
  els.zoomAllBtn = document.getElementById('zoomAllBtn');
  els.toggleLabelsBtn = document.getElementById('toggleLabelsBtn');
  els.totalFeatures = document.getElementById('totalFeatures');
  els.visibleFeatures = document.getElementById('visibleFeatures');
  els.totalCommunes = document.getElementById('totalCommunes');
  els.totalArea = document.getElementById('totalArea');
}

// ─── Map Initialization ───
function initMap() {
  map = L.map('map', {
    center: [32.49, 3.67],
    zoom: 13,
    zoomControl: true,
    preferCanvas: true,   // Better performance for many polygons
    renderer: L.canvas()
  });

  // Dark tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | CartoDB',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  labelLayerGroup = L.layerGroup().addTo(map);
}

// ─── Event Binding ───
function bindEvents() {
  els.searchBtn.addEventListener('click', applyFilters);
  els.resetBtn.addEventListener('click', resetFilters);
  els.detailClose.addEventListener('click', closeDetailPanel);
  els.exportBtn.addEventListener('click', exportSelectedFeature);
  els.zoomAllBtn.addEventListener('click', zoomToAll);
  els.toggleLabelsBtn.addEventListener('click', toggleLabels);
  
  els.sidebarToggle.addEventListener('click', toggleSidebar);

  // Also filter on commune change
  els.communeSelect.addEventListener('change', () => {
    currentFilters.commune = els.communeSelect.value;
    applyFilters();
  });

  // Enter key to search
  els.sectionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyFilters(); });
  els.ilotInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyFilters(); });
}

// ─── GeoJSON Loading (with streaming / progressive approach) ───
async function loadGeoJSON() {
  updateLoadingStatus('جارٍ تحميل ملف البيانات...');
  updateProgress(5);

  try {
    const response = await fetch('/mzab_cadastre_map.geojson');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength) : 0;

    // Use streaming reader for progress tracking
    const reader = response.body.getReader();
    const chunks = [];
    let receivedBytes = 0;

    updateLoadingStatus('جارٍ استلام البيانات...');
    updateProgress(10);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      receivedBytes += value.length;

      if (totalBytes > 0) {
        const pct = Math.min(10 + (receivedBytes / totalBytes) * 50, 60);
        updateProgress(pct);
        const mb = (receivedBytes / 1024 / 1024).toFixed(1);
        const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
        updateLoadingStatus(`تم تحميل ${mb} / ${totalMb} م.ب`);
      }
    }

    updateLoadingStatus('جارٍ تحليل البيانات...');
    updateProgress(65);

    // Concatenate chunks
    const allBytes = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      allBytes.set(chunk, offset);
      offset += chunk.length;
    }

    const text = new TextDecoder().decode(allBytes);

    // Handle potentially concatenated FeatureCollections
    updateLoadingStatus('جارٍ معالجة الميزات...');
    updateProgress(70);

    const features = parseFeatureCollections(text);
    allFeatures = features;

    updateLoadingStatus('جارٍ فهرسة البيانات...');
    updateProgress(80);

    // Build index
    buildCommuneIndex();

    // Populate the commune dropdown
    populateCommuneDropdown();

    // Update statistics
    updateStats(allFeatures.length);

    updateLoadingStatus('جارٍ عرض الخريطة...');
    updateProgress(90);

    // Render all features using lazy/chunked approach
    await renderFeaturesChunked(allFeatures);

    updateProgress(100);
    updateLoadingStatus(`تم تحميل ${allFeatures.length.toLocaleString('ar-SA')} قطعة بنجاح`);

    // Hide loading after a moment
    setTimeout(() => {
      els.loadingOverlay.classList.add('hidden');
    }, 800);

  } catch (err) {
    console.error('Error loading GeoJSON:', err);
    updateLoadingStatus('خطأ في تحميل البيانات: ' + err.message);
    els.progressFill.style.background = 'var(--accent-danger)';
  }
}

/**
 * Parse potentially concatenated FeatureCollections
 */
function parseFeatureCollections(text) {
  const features = [];
  
  // Try to find multiple FeatureCollection objects
  // They might be concatenated: {...}{...}
  let depth = 0;
  let start = -1;
  let jsonBlocks = [];
  
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        jsonBlocks.push(text.substring(start, i + 1));
        start = -1;
      }
    }
  }

  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(block);
      if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        features.push(...parsed.features);
      }
    } catch (e) {
      console.warn('Failed to parse a JSON block, skipping');
    }
  }

  return features;
}

/**
 * Build commune index for fast filtering
 */
function buildCommuneIndex() {
  communeIndex = {};
  allFeatures.forEach((feature, idx) => {
    const commune = feature.properties.COMMUNE || 'مجهول';
    if (!communeIndex[commune]) communeIndex[commune] = [];
    communeIndex[commune].push(idx);
  });
}

/**
 * Populate commune dropdown
 */
function populateCommuneDropdown() {
  const communes = Object.keys(communeIndex).sort();
  els.communeSelect.innerHTML = '<option value="">— جميع البلديات —</option>';
  
  for (const code of communes) {
    const name = COMMUNE_NAMES[code] || code;
    const count = communeIndex[code].length;
    const option = document.createElement('option');
    option.value = code;
    option.textContent = `${name} (${code}) — ${count.toLocaleString('ar-SA')} قطعة`;
    els.communeSelect.appendChild(option);
  }
}

/**
 * Render features in chunks for smooth performance
 */
async function renderFeaturesChunked(features, fitBounds = true) {
  // Remove existing layer
  if (displayedLayer) {
    map.removeLayer(displayedLayer);
    displayedLayer = null;
  }
  labelLayerGroup.clearLayers();

  const CHUNK_SIZE = 5000;
  const totalChunks = Math.ceil(features.length / CHUNK_SIZE);
  
  displayedLayer = L.layerGroup().addTo(map);

  for (let i = 0; i < totalChunks; i++) {
    const chunk = features.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    
    const geoJsonLayer = L.geoJSON({
      type: 'FeatureCollection',
      features: chunk
    }, {
      style: styleFeature,
      onEachFeature: onEachFeature,
      renderer: L.canvas()
    });

    displayedLayer.addLayer(geoJsonLayer);

    // Yield to the browser between chunks
    if (i < totalChunks - 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Update visible count
  els.visibleFeatures.textContent = features.length.toLocaleString('ar-SA');

  // Fit bounds
  if (fitBounds && features.length > 0) {
    try {
      const bounds = displayedLayer.getBounds ? displayedLayer.getBounds() : null;
      // Calculate bounds manually from features
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const f of features) {
        if (f.geometry && f.geometry.coordinates) {
          const coords = flattenCoords(f.geometry.coordinates);
          for (const [lng, lat] of coords) {
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
          }
        }
      }
      if (isFinite(minLat)) {
        map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [30, 30] });
      }
    } catch (e) {
      console.warn('Could not fit bounds:', e);
    }
  }
}

/**
 * Flatten nested coordinate arrays
 */
function flattenCoords(coords) {
  const result = [];
  function recurse(arr) {
    if (typeof arr[0] === 'number') {
      result.push(arr);
    } else {
      for (const item of arr) recurse(item);
    }
  }
  recurse(coords);
  return result;
}

/**
 * Style function for GeoJSON features
 */
function styleFeature(feature) {
  const commune = feature.properties.COMMUNE || 'مجهول';
  const colors = COMMUNE_COLORS[commune] || COMMUNE_COLORS['مجهول'];
  
  return {
    fillColor: colors.fill,
    color: colors.stroke,
    weight: 1,
    opacity: 0.7,
    fillOpacity: 0.5,
    className: ''
  };
}

/**
 * Attach interactivity to each feature
 */
function onEachFeature(feature, layer) {
  layer.on({
    mouseover: handleMouseOver,
    mouseout: handleMouseOut,
    click: handleFeatureClick
  });
}

function handleMouseOver(e) {
  const layer = e.target;
  if (layer === selectedLayer) return;
  
  layer.setStyle({
    fillOpacity: 0.4,
    weight: 2,
    opacity: 1
  });
}

function handleMouseOut(e) {
  const layer = e.target;
  if (layer === selectedLayer) return;
  
  const commune = layer.feature.properties.COMMUNE || 'مجهول';
  const colors = COMMUNE_COLORS[commune] || COMMUNE_COLORS['مجهول'];
  
  layer.setStyle({
    fillOpacity: 0.5,
    weight: 1,
    opacity: 0.7
  });
}

function handleFeatureClick(e) {
  L.DomEvent.stopPropagation(e);
  
  // Deselect previous
  if (selectedLayer) {
    const prevCommune = selectedLayer.feature.properties.COMMUNE || 'مجهول';
    const prevColors = COMMUNE_COLORS[prevCommune] || COMMUNE_COLORS['مجهول'];
    selectedLayer.setStyle({
      fillColor: prevColors.fill,
      color: prevColors.stroke,
      fillOpacity: 0.5,
      weight: 1,
      opacity: 0.7
    });
  }

  const layer = e.target;
  selectedLayer = layer;
  selectedFeature = layer.feature;

  // Highlight selected
  layer.setStyle({
    fillColor: 'rgba(245, 158, 11, 0.5)',
    color: '#f59e0b',
    weight: 3,
    opacity: 1,
    fillOpacity: 0.6
  });

  layer.bringToFront();

  showDetailPanel(selectedFeature);
}

// ─── Detail Panel ───
function showDetailPanel(feature) {
  const props = feature.properties;
  const communeName = COMMUNE_NAMES[props.COMMUNE] || props.COMMUNE || '—';
  const area = props.AREA ? props.AREA.toFixed(2) : '—';
  const section = props.SECTION ?? '—';
  const ilot = props.ILOT ?? '—';
  const tile = props.TILE || '—';

  els.detailBody.innerHTML = `
    <div class="detail-row">
      <span class="detail-row-label">
        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        البلدية
      </span>
      <span class="detail-row-value">${communeName}</span>
    </div>
    <div class="detail-row">
      <span class="detail-row-label">
        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        </svg>
        الرمز الإحصائي
      </span>
      <span class="detail-row-value highlight">${props.COMMUNE || '—'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-row-label">
        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="9" y1="21" x2="9" y2="9"/>
        </svg>
        رقم القسم
      </span>
      <span class="detail-row-value">${section}</span>
    </div>
    <div class="detail-row">
      <span class="detail-row-label">
        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
        </svg>
        رقم القطعة
      </span>
      <span class="detail-row-value">${ilot}</span>
    </div>
    <div class="detail-row">
      <span class="detail-row-label">
        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
        المساحة (م²)
      </span>
      <span class="detail-row-value highlight">${parseFloat(area).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} م²</span>
    </div>
    <div class="detail-row">
      <span class="detail-row-label">
        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18"/>
          <path d="M9 21V9"/>
        </svg>
        المربع
      </span>
      <span class="detail-row-value">${tile}</span>
    </div>
  `;

  els.detailPanel.classList.add('visible');
}

function closeDetailPanel() {
  els.detailPanel.classList.remove('visible');
  
  // Deselect
  if (selectedLayer) {
    const prevCommune = selectedLayer.feature.properties.COMMUNE || 'مجهول';
    const prevColors = COMMUNE_COLORS[prevCommune] || COMMUNE_COLORS['مجهول'];
    selectedLayer.setStyle({
      fillColor: prevColors.fill,
      color: prevColors.stroke,
      fillOpacity: 0.5,
      weight: 1,
      opacity: 0.7
    });
    selectedLayer = null;
    selectedFeature = null;
  }
}

// ─── Export ───
function exportSelectedFeature() {
  if (!selectedFeature) {
    showToast('لم يتم اختيار أي قطعة', 'error');
    return;
  }

  const exportData = {
    type: 'Feature',
    properties: {
      ...selectedFeature.properties,
      communeName: COMMUNE_NAMES[selectedFeature.properties.COMMUNE] || selectedFeature.properties.COMMUNE
    },
    geometry: selectedFeature.geometry
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const commune = selectedFeature.properties.COMMUNE || 'unknown';
  const section = selectedFeature.properties.SECTION || 0;
  const ilot = selectedFeature.properties.ILOT || 0;
  a.download = `cadastre_${commune}_S${section}_I${ilot}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('تم تصدير بيانات القطعة بنجاح', 'success');
}

// ─── Filters ───
function applyFilters() {
  currentFilters.commune = els.communeSelect.value;
  currentFilters.section = els.sectionInput.value.trim();
  currentFilters.ilot = els.ilotInput.value.trim();

  let filtered = allFeatures;

  // Filter by commune
  if (currentFilters.commune) {
    const indices = communeIndex[currentFilters.commune] || [];
    filtered = indices.map(i => allFeatures[i]);
  }

  // Filter by section
  if (currentFilters.section) {
    const sectionNum = parseInt(currentFilters.section);
    filtered = filtered.filter(f => f.properties.SECTION === sectionNum);
  }

  // Filter by ilot
  if (currentFilters.ilot) {
    const ilotNum = parseInt(currentFilters.ilot);
    filtered = filtered.filter(f => f.properties.ILOT === ilotNum);
  }

  // Close detail panel
  closeDetailPanel();

  // Re-render
  renderFeaturesChunked(filtered, true);

  // Show match count
  if (currentFilters.commune || currentFilters.section || currentFilters.ilot) {
    showToast(`تم العثور على ${filtered.length.toLocaleString('ar-SA')} قطعة`, 'info');
  }
  
  // If single result, select it
  if (filtered.length === 1) {
    // We need to find the layer - dispatch after render
    setTimeout(() => {
      if (displayedLayer) {
        displayedLayer.eachLayer(subGroup => {
          if (subGroup.eachLayer) {
            subGroup.eachLayer(layer => {
              if (layer.feature && !selectedLayer) {
                layer.fire('click');
              }
            });
          }
        });
      }
    }, 300);
  }
}

function resetFilters() {
  els.communeSelect.value = '';
  els.sectionInput.value = '';
  els.ilotInput.value = '';
  currentFilters = { commune: '', section: '', ilot: '' };
  closeDetailPanel();
  renderFeaturesChunked(allFeatures, true);
  showToast('تم إعادة تعيين الفلاتر', 'info');
}

// ─── Map Controls ───
function zoomToAll() {
  if (allFeatures.length > 0) {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const f of allFeatures) {
      if (f.geometry && f.geometry.coordinates) {
        const coords = flattenCoords(f.geometry.coordinates);
        for (const [lng, lat] of coords) {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        }
      }
    }
    if (isFinite(minLat)) {
      map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [30, 30] });
    }
  }
}

function toggleLabels() {
  labelsVisible = !labelsVisible;
  if (labelsVisible) {
    // Add labels for displayed features at current zoom
    addLabels();
  } else {
    labelLayerGroup.clearLayers();
  }
}

function addLabels() {
  labelLayerGroup.clearLayers();
  
  if (!displayedLayer) return;

  const bounds = map.getBounds();
  const zoom = map.getZoom();
  
  // Only show labels at higher zoom levels
  if (zoom < 15) {
    showToast('قم بتكبير الخريطة لرؤية التسميات', 'info');
    return;
  }

  let count = 0;
  const MAX_LABELS = 500;

  displayedLayer.eachLayer(subGroup => {
    if (subGroup.eachLayer) {
      subGroup.eachLayer(layer => {
        if (count >= MAX_LABELS) return;
        if (!layer.feature) return;
        
        const center = layer.getBounds ? layer.getBounds().getCenter() : null;
        if (!center || !bounds.contains(center)) return;
        
        const props = layer.feature.properties;
        const label = `Q${props.SECTION || '?'}/I${props.ILOT || '?'}`;
        
        const marker = L.marker(center, {
          icon: L.divIcon({
            className: 'custom-label',
            html: `<span style="
              font-family: Tajawal, sans-serif;
              font-size: 10px;
              color: #f1f5f9;
              background: rgba(10, 14, 23, 0.8);
              padding: 1px 4px;
              border-radius: 3px;
              border: 1px solid rgba(0,229,255,0.3);
              white-space: nowrap;
              pointer-events: none;
            ">${label}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
          }),
          interactive: false
        });
        
        labelLayerGroup.addLayer(marker);
        count++;
      });
    }
  });
}

// ─── Sidebar Toggle ───
function toggleSidebar() {
  els.sidebar.classList.toggle('collapsed');
  
  // Invalidate map size after transition
  setTimeout(() => {
    map.invalidateSize();
  }, 450);
  
  // Show reopen button
  let reopenBtn = document.querySelector('.sidebar-reopen');
  if (!reopenBtn) {
    reopenBtn = document.createElement('button');
    reopenBtn.className = 'sidebar-reopen';
    reopenBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>`;
    reopenBtn.addEventListener('click', () => {
      els.sidebar.classList.remove('collapsed');
      reopenBtn.classList.remove('visible');
      setTimeout(() => map.invalidateSize(), 450);
    });
    document.body.appendChild(reopenBtn);
  }

  if (els.sidebar.classList.contains('collapsed')) {
    reopenBtn.classList.add('visible');
  } else {
    reopenBtn.classList.remove('visible');
  }
}

// ─── Statistics ───
function updateStats(totalCount) {
  els.totalFeatures.textContent = totalCount.toLocaleString('ar-SA');
  els.visibleFeatures.textContent = totalCount.toLocaleString('ar-SA');
  els.totalCommunes.textContent = Object.keys(communeIndex).length.toLocaleString('ar-SA');
  
  // Calculate total area
  let totalArea = 0;
  for (const f of allFeatures) {
    if (f.properties.AREA) totalArea += f.properties.AREA;
  }
  els.totalArea.textContent = totalArea.toLocaleString('ar-SA', { maximumFractionDigits: 0 });
}

// ─── Loading Helpers ───
function updateProgress(pct) {
  els.progressFill.style.width = pct + '%';
}

function updateLoadingStatus(msg) {
  els.loadingStats.textContent = msg;
}

// ─── Toast Notification ───
function showToast(message, type = 'info') {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };
  
  toast.innerHTML = `<span style="font-size: 1.2rem;">${icons[type] || icons.info}</span> ${message}`;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
