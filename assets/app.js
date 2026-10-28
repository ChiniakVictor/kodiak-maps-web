/* Kodiak Maps — web preview. Static MapLibre GL JS page; data is bundled in ./data.
   Privacy: no analytics, no cookies, no network calls except the base-map tile servers.
   "Find me" asks the browser once; the position is drawn on this page only and never sent or stored. */
(function () {
  'use strict';
  const BASE = new URL('.', location.href.split('#')[0]).href;
  const D = (f) => BASE + 'data/' + f;
  const FONT = ['Open Sans Semibold'];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;)])/g, '<a class="a" href="$1" target="_blank" rel="noopener">$1</a>');

  // ---------- colours from the app (MapView.kt / PoiMap.kt / Fishing.kt / Kodiak.kt) ----------
  const ESMT = { trail25: ['#FF9100', '25 ft trail'], trail50: ['#FF3D00', '50 ft trail'], road: ['#D500F9', 'Road'], site: ['#2979FF', 'Site (1 acre)'],
    utility: ['#9E9E9E', 'Utility'], air: ['#78909C', 'Air'], airstrip: ['#00B8D4', 'Airstrip'] };
  const kindColor = ['match', ['get', 'kind'], ...Object.entries(ESMT).flatMap(([k, v]) => [k, v[0]]), '#BDBDBD'];
  const TRAIL = '#00E5FF';
  const FISH = { salt: '#29B6F6', fresh: '#66BB6A', lake: '#FFCA28', ocean: '#283593' };
  const FISH_LBL = { salt: 'Salt water', fresh: 'Fresh water (river/creek)', lake: 'Stocked lake', ocean: 'Offshore ground (boat)' };
  const HIST = { FILL: '#4E342E', EDGE: '#1F120D', LINE: '#6D4C41', BOUND: '#5D4037', RUNWAY: '#8D6E63', PT: '#4E342E' };
  const OWN_COL = { 'State': '#64B5F6', 'USFWS': '#81C784', 'National Park': '#AED581', 'Other Federal': '#4DB6AC', 'Military': '#90A4AE',
    'Native Corporation': '#FFB74D', 'Native Allotment': '#FFCC80', 'Tribal': '#FF8A65', 'Municipal': '#BA68C8', 'Mental Health': '#9575CD',
    'University': '#7986CB', 'Private': '#F48FB1', 'Unclassified': '#B0BEC5', 'Unknown': '#B0BEC5' };
  const POI_ICON = { poi_food: '🍴', poi_travel: '✈', poi_mil: '★', poi_school: '🏫', poi_comm: '📚' };

  // ---------- layer menu (grouped like the app's "Map layers" dialog) ----------
  const MENU = [
    { grp: 'Kodiak Island' },
    { id: 'esmt', t: '17(b) easements', s: 'BLM ANCSA public easements: trails, roads, sites', on: true,
      legend: ['trail25', 'trail50', 'road', 'site'].map((k) => [ESMT[k][0], ESMT[k][1]]) },
    { id: 'row', t: 'State road right-of-way', s: 'Chiniak Hwy & Rezanof Dr (DOT&PF). Approximate band, widths DERIVED (measured from parcel gaps or assumed 100 ft)', on: true },
    { id: 'trails', t: 'Kodiak Trails', s: 'Kodiak Island Borough trail network: 77 trails, 265.5 mi', on: true,
      legend: [[TRAIL, '━ double track'], [TRAIL, '╍ single track'], [TRAIL, '··· route']] },
    { id: 'bike', t: 'Town bike trails', s: "Victor's Town Bike Trail Map: trails in their map colours, trailheads and work spots", on: false },
    { id: 'log', t: 'Chiniak logging roads', s: 'From the kodiakking.com Google Earth map (Victor)', on: true },
    { id: 'parcels', t: 'Property lines', s: 'Borough parcel boundaries only, from zoom 13. No owner, address or value data is included.', on: false },
    { id: 'own', t: 'Land ownership', s: 'Category and agency only (State, Federal, Native corporation, Borough…). Private owners are not named.', on: false },
    { id: 'roads', t: 'Road names', s: 'Kodiak Island Borough roads + DOT&PF centerlines, labelled from zoom 13', on: false },
    { id: 'fish', t: 'Fishing spots', s: 'ADF&G GoFishAK spots, ramps & harbors (blue salt, green fresh, yellow stocked lake)', on: false,
      legend: Object.keys(FISH).map((k) => [FISH[k], FISH_LBL[k].split(' (')[0]]) },
    { grp: 'Places' },
    { id: 'poi_food', t: 'Food', s: 'Restaurants, coffee, groceries', on: false, dot: '#FF7043' },
    { id: 'poi_travel', t: 'Travel', s: 'Airports, ferry, floatplanes, harbors, air taxis', on: false, dot: '#29B6F6' },
    { id: 'poi_school', t: 'Schools', s: 'KIBSD schools and attendance areas', on: false, dot: '#E53935' },
    { id: 'poi_mil', t: 'Military history', s: 'WWII and Cold War sites: Chiniak, Long Island, Fort Abercrombie, Buskin + field-GPS points and features traced from kadiak.org old maps (zoom in)', on: true, dot: '#8D6E63' },
    { id: 'poi_comm', t: 'Community', s: 'Chiniak Public Library', on: false, dot: '#AB47BC' },
  ];
  const SRC_FILE = { esmt: 'easements.geojson', row: 'state_row.geojson', trails: 'trails.geojson', bike: 'bike_trails.geojson', log: 'logging_roads.geojson',
    own: 'ownership.geojson', roads: 'roads.geojson', fish: 'fishing.geojson', poi: 'poi.geojson' };
  const KEY = 'kodiakmaps-web-v1';
  let state = { base: 'usgs', on: Object.fromEntries(MENU.filter((m) => m.id).map((m) => [m.id, m.on])) };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.on) state = { base: s.base || 'usgs', on: { ...state.on, ...s.on } }; } catch (e) { /* private mode */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };

  // ---------- base style: the app's usgs-style.json + otm-style.json merged into one style ----------
  async function baseStyle() {
    const [u, o] = await Promise.all(['usgs-style.json', 'otm-style.json'].map((f) => fetch(BASE + 'assets/styles/' + f).then((r) => r.json())));
    const style = { version: 8, name: 'Kodiak Maps web', glyphs: BASE + 'assets/glyphs/{fontstack}/{range}.pbf',
      sources: { ...u.sources, ...o.sources }, layers: [] };
    style.layers.push(u.layers.find((l) => l.type === 'background'));
    const ul = u.layers.find((l) => l.type === 'raster'); const ol = o.layers.find((l) => l.type === 'raster');
    style.layers.push({ ...ul, id: 'base-usgs', layout: { visibility: state.base === 'usgs' ? 'visible' : 'none' } });
    style.layers.push({ ...ol, id: 'base-otm', layout: { visibility: state.base === 'otm' ? 'visible' : 'none' } });
    return style;
  }

  const zl = (a, b, c) => ['interpolate', ['linear'], ['zoom'], ...a.flatMap((v, i) => [v[0], v[1]])];
  const PT = ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]];
  const LN = ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]];
  const PG = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]];
  const halo = { 'text-halo-color': '#0c0f12', 'text-halo-width': 1.6, 'text-halo-blur': 0.4 };

  // layer definitions per toggle: [id, source, type, filter, paint, layout, minzoom, maxzoom]
  function defs() {
    return {
      own: [
        ['own-fill', 'own', 'fill', null, { 'fill-color': ['match', ['get', 'type'], ...Object.entries(OWN_COL).flat(), '#F48FB1'], 'fill-opacity': 0.12 }, {}, 8],
        ['own-line', 'own', 'line', null, { 'line-color': '#F48FB1', 'line-opacity': 0.7, 'line-width': zl([[8, 0.8], [14, 1.8]]), 'line-dasharray': [4, 2] }, {}, 8],
      ],
      parcels: [
        ['parcel-fill', 'parcels', 'fill', null, { 'fill-color': '#F48FB1', 'fill-opacity': 0.01 }, {}, 13],
        ['parcel-line', 'parcels', 'line', null, { 'line-color': '#EC407A', 'line-opacity': 0.85, 'line-width': zl([[13, 0.8], [16, 1.6], [18, 2.4]]) }, {}, 13],
      ],
      roads: [
        ['road-hit', 'roads', 'line', null, { 'line-color': '#FFFFFF', 'line-opacity': 0.01, 'line-width': 10 }, {}, 10],
        ['road-label', 'roads', 'symbol', ['has', 'label'], { 'text-color': '#FFFFFF', ...halo },
          { 'symbol-placement': 'line', 'symbol-spacing': 500, 'text-field': ['get', 'label'], 'text-font': FONT, 'text-size': 12, 'text-padding': 2 }, 13],
      ],
      row: [
        ['row-fill', 'row', 'fill', ['==', ['get', 'k'], 'row'], { 'fill-color': '#FFC107', 'fill-opacity': ['match', ['get', 'basis'], 'measured', 0.28, 0.16] }],
        ['row-line', 'row', 'line', ['==', ['get', 'k'], 'row'], { 'line-color': '#FFA000', 'line-width': 1.2, 'line-opacity': 0.8, 'line-dasharray': [4, 2] }],
        ['row-cl', 'row', 'line', ['==', ['get', 'k'], 'rowcl'], { 'line-color': '#FFE082', 'line-width': 1, 'line-opacity': 0.6 }, {}, 13],
      ],
      trails: [
        ['trail-casing', 'trails', 'line', ['!=', ['get', 'cls'], 'route'], { 'line-color': '#00363D', 'line-opacity': 0.55, 'line-width': zl([[9, 2.6], [13, 4.6], [16, 7], [18, 10]]) }, { 'line-cap': 'round', 'line-join': 'round' }],
        ['trail-solid', 'trails', 'line', ['in', ['get', 'cls'], ['literal', ['double', 'shared']]], { 'line-color': TRAIL, 'line-width': zl([[9, 1.2], [13, 2.4], [16, 4], [18, 6]]) }, { 'line-cap': 'round', 'line-join': 'round' }],
        ['trail-single', 'trails', 'line', ['==', ['get', 'cls'], 'single'], { 'line-color': TRAIL, 'line-width': zl([[9, 1.2], [13, 2.4], [16, 4], [18, 6]]), 'line-dasharray': [3, 1.6] }, { 'line-join': 'round' }],
        ['trail-route', 'trails', 'line', ['==', ['get', 'cls'], 'route'], { 'line-color': TRAIL, 'line-width': zl([[9, 2], [13, 3.4], [16, 5], [18, 7]]), 'line-dasharray': [0.1, 2] }, { 'line-cap': 'round' }],
        ['trail-label', 'trails', 'symbol', ['has', 'label'], { 'text-color': '#B2EBF2', ...halo },
          { 'symbol-placement': 'line', 'symbol-spacing': 450, 'text-field': ['get', 'label'], 'text-font': FONT, 'text-size': 12, 'text-padding': 4 }, 13.5],
      ],
      bike: [
        ['bike-casing', 'bike', 'line', ['==', ['get', 'k'], 'bikeline'], { 'line-color': '#FFFFFF', 'line-opacity': 0.8, 'line-width': zl([[11, 2.6], [14, 4.6], [17, 8]]) }, { 'line-cap': 'round', 'line-join': 'round' }],
        ['bike-line', 'bike', 'line', ['==', ['get', 'k'], 'bikeline'], { 'line-color': ['coalesce', ['get', 'color'], '#E040FB'], 'line-width': zl([[11, 1.4], [14, 2.6], [17, 5]]) }, { 'line-cap': 'round', 'line-join': 'round' }],
        ['bike-pt', 'bike', 'circle', ['==', ['get', 'k'], 'bikept'], { 'circle-color': ['match', ['get', 'kind'], 'head', '#43A047', 'work', '#FF6D00', '#9E9E9E'], 'circle-radius': zl([[11, 3.5], [15, 6.5]]), 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.8 }],
        ['bike-label', 'bike', 'symbol', ['has', 'label'], { 'text-color': '#F3E5F5', ...halo },
          { 'text-field': ['get', 'label'], 'text-font': FONT, 'text-size': 11.5, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true }, 14],
      ],
      log: [
        ['log-casing', 'log', 'line', ['==', ['get', 'k'], 'logroad'], { 'line-color': '#000000', 'line-opacity': 0.45, 'line-width': zl([[9, 2.6], [14, 5], [17, 8]]) }, { 'line-cap': 'round', 'line-join': 'round' }],
        ['log-line', 'log', 'line', ['==', ['get', 'k'], 'logroad'], { 'line-color': ['coalesce', ['get', 'color'], '#FFEB3B'], 'line-width': zl([[9, 1.4], [14, 3], [17, 5]]) }, { 'line-cap': 'round', 'line-join': 'round' }],
        ['log-area-casing', 'log', 'line', ['==', ['get', 'k'], 'logarea'], { 'line-color': '#000000', 'line-opacity': 0.5, 'line-width': 4.5 }],
        ['log-area', 'log', 'line', ['==', ['get', 'k'], 'logarea'], { 'line-color': ['coalesce', ['get', 'color'], '#FFFFFF'], 'line-width': 2.2, 'line-opacity': 0.9, 'line-dasharray': [3, 1.5] }],
        ['log-pin', 'log', 'circle', ['==', ['get', 'k'], 'logpin'], { 'circle-color': ['coalesce', ['get', 'color'], '#2979FF'], 'circle-radius': zl([[9, 4], [15, 7]]), 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 }],
        ['log-label', 'log', 'symbol', ['all', ['has', 'label'], ['!=', ['get', 'k'], 'logarea']], { 'text-color': '#FFF9C4', ...halo },
          { 'text-field': ['get', 'label'], 'text-font': FONT, 'text-size': 11.5, 'symbol-placement': 'point', 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true }, 14],
      ],
      esmt: [
        ['esmt-area', 'esmt', 'fill', PG, { 'fill-color': kindColor, 'fill-opacity': 0.25 }],
        ['esmt-area-line', 'esmt', 'line', PG, { 'line-color': kindColor, 'line-width': 1.5, 'line-dasharray': [2, 1.5] }],
        ['esmt-line-casing', 'esmt', 'line', LN, { 'line-color': '#000000', 'line-opacity': 0.35, 'line-width': zl([[8, 2.5], [14, 5], [17, 8]]) }],
        ['esmt-line', 'esmt', 'line', LN, { 'line-color': kindColor, 'line-width': zl([[8, 1.5], [14, 3], [17, 5]]), 'line-dasharray': [2.2, 1.4] }],
        ['esmt-pt', 'esmt', 'circle', PT, { 'circle-color': kindColor, 'circle-radius': zl([[8, 4], [13, 6], [16, 8]]), 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.8 }],
        ['esmt-label', 'esmt', 'symbol', ['has', 'label'], { 'text-color': '#FFFFFF', ...halo },
          { 'text-field': ['get', 'label'], 'text-font': FONT, 'text-size': 11.5, 'symbol-placement': 'point', 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true }, 12.5],
      ],
      fish: [
        ['fish-pt', 'fish', 'circle', null, { 'circle-color': ['match', ['get', 'type'], ...Object.entries(FISH).flat(), '#B0BEC5'], 'circle-radius': zl([[8, 7], [14, 10]]), 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5 }],
        ['fish-icon', 'fish', 'symbol', null, {}, { 'icon-image': 'fish', 'icon-size': zl([[8, 0.55], [14, 0.75]]), 'icon-allow-overlap': true, 'icon-ignore-placement': true }],
        ['fish-label', 'fish', 'symbol', null, { 'text-color': ['match', ['get', 'type'], 'ocean', '#9FA8DA', ...Object.entries(FISH).filter(([k]) => k !== 'ocean').flat(), '#B0BEC5'], ...halo },
          { 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': 11.5, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-optional': true }, 11],
      ],
    };
  }
  // POI layers (one source, filtered by the Places switches like PoiMap.apply)
  const isPt = ['any', ['!', ['has', 'shape']], ['==', ['get', 'shape'], 'pt']];
  const isLn = ['any', ['==', ['get', 'shape'], 'ln'], ['all', ['==', ['get', 'shape'], 'poly'], ['!=', ['get', 'fill'], 1]]];
  const isPoly = ['all', ['==', ['get', 'shape'], 'poly'], ['==', ['get', 'fill'], 1]];
  const isHistPt = ['all', ['has', 'detail'], ['has', 'src_map']];
  const col = ['coalesce', ['get', 'color'], '#FFFFFF'];
  const POI_LAYERS = [
    ['poi-zone-fill', 'fill', { 'fill-color': col, 'fill-opacity': 0.16 }],
    ['poi-zone-line', 'line', { 'line-color': col, 'line-opacity': 0.9, 'line-width': zl([[8, 1.2], [14, 2.6]]) }],
    ['poi-hfill', 'fill', { 'fill-color': HIST.FILL, 'fill-opacity': ['match', ['get', 'typ'], 'area', 0.5, 0.65], 'fill-outline-color': HIST.EDGE }, {}, 11],
    ['poi-hedge', 'line', { 'line-color': HIST.EDGE, 'line-width': zl([[11, 1.2], [14, 1.8], [16, 2.4]]) }, { 'line-join': 'miter' }, 11],
    ['poi-hline', 'line', { 'line-color': ['match', ['get', 'typ'], 'boundary', HIST.BOUND, 'runway', HIST.RUNWAY, HIST.LINE],
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, ['match', ['get', 'typ'], 'runway', 7, 'road', 2.4, 1.6], 16, ['match', ['get', 'typ'], 'runway', 7, 2.8]], 'line-opacity': ['match', ['get', 'typ'], 'runway', 0.8, 1],
      'line-dasharray': ['match', ['get', 'typ'], 'runway', ['literal', [1, 0]], ['literal', [3, 2]]] }, {}, 11],
    ['poi-pt', 'circle', { 'circle-color': col, 'circle-radius': zl([[8, 6], [14, 11], [17, 14]]), 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 }],
    ['poi-dpt', 'circle', { 'circle-color': col, 'circle-radius': zl([[14, 4.5], [17, 8]]), 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5 }, {}, 14],
    ['poi-hpt', 'circle', { 'circle-color': HIST.PT, 'circle-radius': zl([[13, 4], [17, 8]]), 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5 }, {}, 13],
    ['poi-icon', 'symbol', {}, { 'icon-image': ['concat', 'poi-ic-', ['get', 'k']], 'icon-size': zl([[8, 0.45], [14, 0.7]]), 'icon-allow-overlap': true, 'icon-ignore-placement': true }],
    ['poi-label', 'symbol', { 'text-color': '#FFFFFF', ...halo }, { 'text-field': ['get', 'label'], 'text-font': FONT, 'text-size': 11.5, 'text-anchor': 'top', 'text-offset': [0, 1.5], 'text-optional': true, 'text-max-width': 12 }, 14],
  ];
  function poiFilters() {
    const kinds = ['poi_food', 'poi_travel', 'poi_mil', 'poi_school', 'poi_comm'].filter((k) => state.on[k]);
    const pf = kinds.length ? ['in', ['get', 'k'], ['literal', kinds]] : ['==', ['get', 'k'], '__none__'];
    const milOn = ['==', ['get', 'k'], state.on.poi_mil ? 'poi_mil' : '__none__'];
    const main = ['all', pf, isPt, ['!', ['has', 'detail']]];
    return {
      'poi-zone-fill': ['all', ['==', ['get', 'k'], 'poi_zone'], ['==', ['get', 'fill'], 1], ['literal', !!state.on.poi_school]],
      'poi-zone-line': ['all', ['==', ['get', 'k'], 'poi_zone'], ['literal', !!state.on.poi_school]],
      'poi-hfill': ['all', milOn, isPoly], 'poi-hedge': ['all', milOn, isPoly], 'poi-hline': ['all', milOn, isLn],
      'poi-pt': main, 'poi-icon': main,
      'poi-dpt': ['all', pf, isPt, ['has', 'detail'], ['!', ['has', 'src_map']]],
      'poi-hpt': ['all', milOn, isPt, isHistPt],
      'poi-label': ['all', ['has', 'label'], pf, isPt, ['!=', ['get', 'k'], 'poi_zone']],
    };
  }

  // ---------- map ----------
  const narrow = matchMedia('(max-width:720px)').matches;
  let map;
  const loaded = {};
  function emojiImage(e, bg) {
    const s = 48, c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2); g.fill(); }
    g.font = '30px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#101214';
    g.fillText(e, s / 2, s / 2 + 2);
    return g.getImageData(0, 0, s, s);
  }
  function ensureSource(key) {
    if (loaded[key]) return;
    loaded[key] = true;
    map.getSource(key).setData(D(SRC_FILE[key]));
  }
  function setVis(ids, on) { ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')); }
  const LAYER_IDS = {};
  function applyState() {
    const d = defs();
    Object.keys(d).forEach((k) => { if (state.on[k] && k !== 'parcels') ensureSource(k); setVis(LAYER_IDS[k], !!state.on[k]); });
    const poiOn = ['poi_food', 'poi_travel', 'poi_mil', 'poi_school', 'poi_comm'].some((k) => state.on[k]);
    if (poiOn) ensureSource('poi');
    const f = poiFilters();
    POI_LAYERS.forEach(([id]) => { map.setFilter(id, f[id]); map.setLayoutProperty(id, 'visibility', poiOn ? 'visible' : 'none'); });
    map.setLayoutProperty('base-usgs', 'visibility', state.base === 'usgs' ? 'visible' : 'none');
    map.setLayoutProperty('base-otm', 'visibility', state.base === 'otm' ? 'visible' : 'none');
    $('baseName').textContent = state.base === 'usgs' ? 'USGS topo' : 'OpenTopoMap';
    updateParcels();
  }

  // parcels: geometry-only chunks, fetched only for the visible area at zoom >= 13
  let pIndex = null; const pCache = {}; let pBusy = false;
  async function updateParcels() {
    const z = map.getZoom();
    $('zoomHint').hidden = !(state.on.parcels && z < 13);
    if (!state.on.parcels || z < 13 || pBusy) return;
    pBusy = true;
    try {
      if (!pIndex) pIndex = await fetch(D('parcels/index.json')).then((r) => r.json());
      const b = map.getBounds(); const [w, s, e, n] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      const need = pIndex.filter((c) => !(c.b[0] > e || c.b[2] < w || c.b[1] > n || c.b[3] < s) && !pCache[c.f]);
      if (need.length) {
        await Promise.all(need.map((c) => fetch(D('parcels/' + c.f)).then((r) => r.json()).then((j) => { pCache[c.f] = j.features; })));
        map.getSource('parcels').setData({ type: 'FeatureCollection', features: Object.values(pCache).flat() });
      }
    } catch (err) { status('Could not load property lines: ' + err.message, 4000); }
    pBusy = false;
  }

  async function init() {
    const style = await baseStyle();
    map = new maplibregl.Map({
      container: 'map', style, center: [-152.62, 57.62], zoom: narrow ? 8.2 : 8.8, maxZoom: 18, minZoom: 3, hash: 'map',
      attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
    });
    map.touchZoomRotate.disableRotation();
    window.kodiakMap = map; // handy for debugging in the browser console
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'imperial', maxWidth: 110 }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true,
      customAttribution: 'Data: BLM · Kodiak Island Borough · Alaska DOT&amp;PF · ADF&amp;G · NOAA · kadiak.org · Victor (kodiakking.com)' }), 'bottom-right');
    map.on('load', () => {
      map.addImage('fish', emojiImage('🐟'));
      Object.entries(POI_ICON).forEach(([k, e]) => map.addImage('poi-ic-' + k, emojiImage(e)));
      const empty = { type: 'FeatureCollection', features: [] };
      ['own', 'parcels', 'roads', 'row', 'trails', 'bike', 'log', 'esmt', 'fish', 'poi'].forEach((s) => map.addSource(s, { type: 'geojson', data: empty, tolerance: 0.3 }));
      map.addSource('me', { type: 'geojson', data: empty });
      const d = defs();
      const order = ['own', 'parcels', 'roads', 'row', 'trails', 'bike', 'log', 'esmt', 'fish'];
      order.forEach((k) => {
        LAYER_IDS[k] = [];
        d[k].forEach(([id, src, type, filter, paint, layout, minz, maxz]) => {
          if (type === 'symbol') return; // labels added last so they sit on top
          const L = { id, source: src, type, paint: paint || {}, layout: { ...(layout || {}), visibility: 'none' } };
          if (filter) L.filter = filter; if (minz) L.minzoom = minz; if (maxz) L.maxzoom = maxz;
          map.addLayer(L); LAYER_IDS[k].push(id);
        });
      });
      POI_LAYERS.filter((l) => l[1] !== 'symbol').forEach(([id, type, paint, layout, minz]) => {
        const L = { id, source: 'poi', type, paint, layout: { ...(layout || {}), visibility: 'none' } }; if (minz) L.minzoom = minz; map.addLayer(L);
      });
      order.forEach((k) => d[k].forEach(([id, src, type, filter, paint, layout, minz, maxz]) => {
        if (type !== 'symbol') return;
        const L = { id, source: src, type, paint: paint || {}, layout: { ...(layout || {}), visibility: 'none' } };
        if (filter) L.filter = filter; if (minz) L.minzoom = minz; if (maxz) L.maxzoom = maxz;
        map.addLayer(L); LAYER_IDS[k].push(id);
      }));
      POI_LAYERS.filter((l) => l[1] === 'symbol').forEach(([id, type, paint, layout, minz]) => {
        const L = { id, source: 'poi', type, paint, layout: { ...(layout || {}), visibility: 'none' } }; if (minz) L.minzoom = minz; map.addLayer(L);
      });
      map.addLayer({ id: 'me-acc', source: 'me', type: 'fill', filter: PG, paint: { 'fill-color': '#2979FF', 'fill-opacity': 0.18 } });
      map.addLayer({ id: 'me-acc-line', source: 'me', type: 'line', filter: PG, paint: { 'line-color': '#2979FF', 'line-width': 1.5, 'line-opacity': 0.8 } });
      map.addLayer({ id: 'me-halo', source: 'me', type: 'circle', filter: PT, paint: { 'circle-radius': 18, 'circle-color': '#2979FF', 'circle-opacity': 0.25 } });
      map.addLayer({ id: 'me-dot', source: 'me', type: 'circle', filter: PT, paint: { 'circle-radius': 9, 'circle-color': '#2979FF', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
      applyState();
      map.on('moveend', updateParcels);
      map.on('click', onClick);
      const tap = TAP_LAYERS();
      map.on('mousemove', (e) => { map.getCanvas().style.cursor = map.queryRenderedFeatures(e.point, { layers: tap.filter((l) => map.getLayer(l)) }).length ? 'pointer' : ''; });
      // On small screens start with the credits collapsed to the (i) button; full credits are in About.
      if (window.innerWidth < 720) setTimeout(() => document.querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact-show').forEach((e) => { e.classList.remove('maplibregl-compact-show'); e.removeAttribute('open'); }), 0);
      document.body.dataset.ready = '1';
    });
    map.on('error', (e) => { if (e && e.error && !/tile|Failed to fetch|AJAXError/i.test(String(e.error.message))) console.warn(e.error); });
  }

  // ---------- tap for info ----------
  const TAP_LAYERS = () => ['poi-icon', 'poi-pt', 'poi-dpt', 'poi-hpt', 'poi-hedge', 'poi-hline', 'poi-hfill', 'fish-pt', 'esmt-pt', 'esmt-line', 'esmt-area',
    'log-pin', 'log-line', 'log-area', 'bike-pt', 'bike-line', 'trail-solid', 'trail-single', 'trail-route', 'row-fill', 'road-hit', 'poi-zone-fill', 'parcel-fill', 'own-fill'];
  function onClick(e) {
    const pad = narrow ? 10 : 6;
    const box = [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]];
    const layers = TAP_LAYERS().filter((l) => map.getLayer(l) && map.getLayoutProperty(l, 'visibility') !== 'none');
    const fs = map.queryRenderedFeatures(box, { layers });
    if (!fs.length) { closeSheet(); return; }
    const rank = (f) => TAP_LAYERS().indexOf(f.layer.id);
    fs.sort((a, b) => rank(a) - rank(b));
    showFeature(fs[0], e.lngLat);
  }
  const row = (k, v, cls) => (v == null || v === '' ? '' : `<tr${cls ? ` class="${cls}"` : ''}><th>${esc(k)}</th><td>${linkify(v)}</td></tr>`);
  const pill = (txt, c) => `<span class="cat" style="color:${c};border-color:${c}66">${esc(txt)}</span>`;
  function showFeature(f, ll) {
    const p = f.properties || {}; const id = f.layer.id; let title = '', html = '';
    if (id.startsWith('poi-')) {
      title = p.name || p.label || 'Place';
      html += pill(p.cat_label || '', p.color || '#7fd3ff');
      const rows = String(p.rows || '').split('\u001f').filter(Boolean).map((r) => r.split('\u001e'));
      html += '<table class="kv">' + rows.map(([k, v]) => (k === 'Summary' ? `<tr class="sum"><td colspan="2">${linkify(v)}</td></tr>` : row(k, v))).join('') + '</table>';
      if (p.note) html += `<p class="warn">${linkify(p.note)}</p>`;
      const links = [];
      if (p.phone) links.push(`<a href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ''))}">📞 Call</a>`);
      if (p.web) links.push(`<a href="${esc(p.web)}" target="_blank" rel="noopener">🌐 Website</a>`);
      if (links.length) html += `<div class="linkrow">${links.join('')}</div>`;
      if (p.k === 'poi_mil') html += `<div class="credit">Credit: ${esc(p.credit || 'kadiak.org')} — <a class="a" href="https://www.kadiak.org/" target="_blank" rel="noopener">kadiak.org</a> (Kodiak Historical Army/Navy site).${p.acc_m ? ' Position accuracy about ±' + esc(p.acc_m) + ' m.' : ''}</div>`;
    } else if (id.startsWith('esmt')) {
      title = p.name || p.label || p.type || '17(b) easement';
      html += pill(p.type || p.cat || 'Easement', (ESMT[p.kind] || ['#BDBDBD'])[0]);
      html += '<table class="kv">' + row('EIN', p.ein) + row('Uses', p.uses) + row('Note', p.note) + row('Restrictions', p.restrict) + row('Reserved', p.reserved)
        + row('Landowner', p.owner) + row('Administered by', p.agency) + row('Gives access to', p.accessed) + row('Acres', p.acres) + row('Patent', p.patent)
        + row('Position accuracy', p.acc) + '</table>';
      html += '<p class="note">Widths are derived from the easement type (25/50 ft trails, 60 ft existing road, 100 ft proposed road, 1-acre sites). BLM digitizing; not a survey.</p>';
      if (p.doc) html += `<div class="linkrow"><a href="${esc(p.doc)}" target="_blank" rel="noopener">Legal description (BLM)</a></div>`;
      html += '<div class="credit">Source: BLM Alaska ANCSA 17(b) easements (gis.blm.gov)</div>';
    } else if (id.startsWith('fish')) {
      title = p.name; html += pill(FISH_LBL[p.type] || p.cat || 'Fishing', FISH[p.type] === '#283593' ? '#9FA8DA' : FISH[p.type] || '#B0BEC5');
      html += '<table class="kv">' + row('Type', p.cat) + row('Species', p.species) + row('Timing', p.timing) + row('About', p.desc) + row('Access', p.access || p.accessType)
        + row('Getting there', p.getting) + row('Parking', p.parking) + row('Season', p.season) + row('Tackle', p.tackle) + row('Stocked', p.stocked) + row('Position check', p.acc) + '</table>';
      if (p.eo) html += `<p class="warn">⚠ ${linkify(p.eo)}</p>`;
      html += '<p class="note">Check current ADF&amp;G regulations and emergency orders before fishing.</p>';
      html += `<div class="linkrow">${p.more ? `<a href="${esc(p.more)}" target="_blank" rel="noopener">ADF&amp;G area info</a>` : ''}<a href="https://www.adfg.alaska.gov/index.cfm?adfg=fishingSportFishingInfo.emergencyorders" target="_blank" rel="noopener">Emergency orders</a></div>`;
      html += `<div class="credit">Source: ${esc(p.src || 'ADF&G')}</div>`;
    } else if (id.startsWith('log')) {
      title = p.name || (p.k === 'logpin' ? 'Logging road pin' : p.k === 'logarea' ? 'Borough property outline' : 'Chiniak logging road');
      html += '<table class="kv">' + row('Note', p.desc) + row('Folder', p.folder) + '</table><div class="credit">Source: Victor (kodiakking.com) — Chiniak logging roads Google Earth map. Not an official road; conditions unknown.</div>';
    } else if (id.startsWith('bike')) {
      title = p.name || 'Town bike trail';
      html += '<table class="kv">' + row('Note', p.desc) + row('Folder', p.folder) + row('Length', p.len_m ? (p.len_m / 1609.34).toFixed(2) + ' mi' : '') + '</table><div class="credit">Source: Victor — Town Bike Trail Map (kodiakking.com)</div>';
    } else if (id.startsWith('trail')) {
      title = p.name || 'Trail';
      html += pill({ double: 'Double track', single: 'Single track', route: 'Route', shared: 'Shared-use path' }[p.cls] || p.type || 'Trail', TRAIL);
      html += '<table class="kv">' + row('Type', p.type) + row('Length', p.miles ? Number(p.miles).toFixed(1) + ' mi' : '') + '</table><div class="credit">Source: Kodiak Island Borough KIB_Trails (data edited 2025-08-19). No warranty.</div>';
    } else if (id.startsWith('row')) {
      title = (p.route || 'State road') + ' right-of-way'; html += pill((p.basis === 'measured' ? 'Measured' : 'Assumed') + ' width — DERIVED', '#FFC107');
      html += '<table class="kv">' + row('Milepost', p.mp) + row('Width', p.width_ft ? p.width_ft + ' ft (' + p.left_ft + ' / ' + p.right_ft + ' ft each side)' : '') + row('Owner', p.owner) + row('Basis', p.basis_text) + row('Source', p.source) + '</table>';
      html += '<p class="warn">Approximate band. Exact ROW limits are on DOT&amp;PF right-of-way plans.</p>';
    } else if (id.startsWith('road')) {
      title = p.name || 'Road';
      html += '<table class="kv">' + row('Class', p.type) + row('Owner', p.owner) + row('Maintained by', p.maint) + row('Paved', p.paved) + row('Width', p.width_ft ? p.width_ft + ' ft' : '') + row('Source', p.src) + '</table>';
    } else if (id === 'parcel-fill') {
      title = 'Property line'; html += '<p>Kodiak Island Borough parcel boundary. Owner, address, value and legal description are deliberately <b>not included</b> on this map.</p>'
        + '<p class="note">Assessing GIS, not a survey. For parcel records use the Kodiak Island Borough\'s own GIS / assessing office.</p>'
        + '<div class="linkrow"><a href="https://www.kodiakak.us/" target="_blank" rel="noopener">Kodiak Island Borough</a></div>';
    } else if (id === 'own-fill') {
      title = p.type === 'Private' ? 'Private land' : (p.agency || p.type || 'Land ownership');
      html += pill(p.type || 'Ownership', OWN_COL[p.type] || '#F48FB1') + '<table class="kv">' + row('Category', p.type) + row('Agency / owner', p.agency) + '</table>'
        + '<p class="note">Category level only. Private owners are not named. Source: Kodiak Island Borough KIB_Ownership (no warranty).</p>';
    }
    openSheet(title, html);
  }

  // ---------- panels ----------
  function openPanel(title, html) { $('panelTitle').textContent = title; $('panelBody').innerHTML = html; $('panel').hidden = false; }
  function closePanel() { $('panel').hidden = true; $('btnLayers').setAttribute('aria-expanded', 'false'); }
  function openSheet(title, html) { $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html; $('sheet').hidden = false; $('sheetBody').scrollTop = 0; if (narrow) closePanel(); }
  function closeSheet() { $('sheet').hidden = true; }
  document.querySelector('[data-close]').onclick = closePanel;
  document.querySelector('[data-close-sheet]').onclick = closeSheet;
  let stT; function status(msg, ms) { const s = $('status'); s.textContent = msg; s.hidden = false; clearTimeout(stT); if (ms) stT = setTimeout(() => { s.hidden = true; }, ms); }

  function layersHtml() {
    let h = '';
    MENU.forEach((m) => {
      if (m.grp) { h += `<div class="grp">${esc(m.grp)}</div>`; return; }
      h += `<label class="sw"><input type="checkbox" data-layer="${m.id}" ${state.on[m.id] ? 'checked' : ''}><span><span class="t">${m.dot ? `<span class="dot" style="background:${m.dot}"></span>` : ''}${esc(m.t)}</span><br><span class="s">${esc(m.s)}</span></span></label>`;
      if (m.legend) h += `<div class="legend">${m.legend.map(([c, l]) => `<span><span class="dot" style="background:${c}"></span>${esc(l)}</span>`).join('')}</div>`;
    });
    h += '<p class="note" style="margin-top:12px">Tap anything on the map for details. Layer choices are remembered in this browser only.</p>';
    return h;
  }
  $('btnLayers').onclick = () => {
    if (!$('panel').hidden && $('panelTitle').textContent === 'Map layers') { closePanel(); return; }
    openPanel('Map layers', layersHtml()); $('btnLayers').setAttribute('aria-expanded', 'true'); if (narrow) closeSheet();
    $('panelBody').querySelectorAll('input[data-layer]').forEach((i) => { i.onchange = () => { state.on[i.dataset.layer] = i.checked; save(); applyState(); }; });
  };
  $('btnBase').onclick = () => { state.base = state.base === 'usgs' ? 'otm' : 'usgs'; save(); applyState(); status('Base map: ' + $('baseName').textContent, 1500); };

  // ---------- tides (static NOAA predictions bundled from the app) ----------
  let tides = null; let tideStation = 0;
  async function showTides() {
    if (!tides) { status('Loading tide table…'); tides = await fetch(D('tides.json')).then((r) => r.json()); $('status').hidden = true; }
    const st = tides.stations[tideStation];
    const now = Date.now(), end = now + 7 * 864e5;
    const fmtD = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Anchorage', weekday: 'short', month: 'short', day: 'numeric' });
    const fmtT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Anchorage', hour: 'numeric', minute: '2-digit' });
    const ev = st.events.map(([t, h, k]) => [Date.parse(t.replace(' ', 'T') + 'Z'), h, k]).filter(([t]) => t >= now - 6 * 36e5 && t <= end);
    let last = '', rows = '';
    ev.forEach(([t, h, k]) => {
      const d = fmtD.format(t); if (d !== last) { rows += `<tr class="day"><td colspan="3">${esc(d)}</td></tr>`; last = d; }
      rows += `<tr><td>${esc(fmtT.format(t))}</td><td class="${k === 'H' ? 'hi' : 'lo'}">${k === 'H' ? 'High' : 'Low'}</td><td>${h.toFixed(1)} ft</td></tr>`;
    });
    const opts = tides.stations.map((s, i) => `<option value="${i}" ${i === tideStation ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
    openPanel('Tides', `<select id="tideSel" aria-label="Tide station">${opts}</select>
      <p class="note">Next 7 days, Alaska time. Heights in feet above MLLW. Predictions only (weather changes real water levels). Not for navigation.</p>
      <table class="tides">${rows || '<tr><td>No predictions for these dates in the bundled table.</td></tr>'}</table>
      <div class="credit">NOAA CO-OPS tide predictions, station ${esc(st.id)}, fetched ${esc(tides.fetched)} (covers to Dec 31, 2027). <a class="a" href="https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=${esc(st.id)}" target="_blank" rel="noopener">Live NOAA page</a></div>`);
    $('tideSel').onchange = (e) => { tideStation = +e.target.value; showTides(); };
    map.flyTo({ center: [st.lon, st.lat], zoom: Math.max(map.getZoom(), 10) });
  }
  $('btnTides').onclick = () => { if (!$('panel').hidden && $('panelTitle').textContent === 'Tides') { closePanel(); return; } if (narrow) closeSheet(); showTides(); };

  // ---------- credits / disclaimer ----------
  $('btnInfo').onclick = () => {
    if (!$('panel').hidden && $('panelTitle').textContent === 'About this map') { closePanel(); return; }
    if (narrow) closeSheet();
    openPanel('About this map', `
      <p><b>Kodiak Maps — web preview.</b> A browser version of Victor's Kodiak Maps Android app: zoom, switch base maps and layers, and tap things for details.
      The Android app adds offline maps, live GPS, pins, track recording and navigation.</p>
      <div class="grp">Disclaimer</div>
      <p class="warn">Not a survey and not legal advice. Easement widths and state right-of-way widths are <b>derived</b> (from easement type, gaps between borough parcels, or an assumed 100 ft).
      Parcel lines are assessing GIS, not a survey. Positions can be off by tens of metres in places. Everything is provided as-is, with no warranty.
      Check with BLM, Alaska DOT&amp;PF, the Kodiak Island Borough and ADF&amp;G before relying on it.</p>
      <div class="grp">Privacy</div>
      <p class="note">No accounts, cookies, ads or analytics. "Find me" asks your browser once; your position is shown on this page only and is never sent or saved.
      Property lines carry no owner, address, value or legal-description data.</p>
      <div class="grp">Credits</div>
      <table class="kv">
        ${row('Base map', 'USGS The National Map: 3DEP, NHD, GNIS, NBD, NTD and partners (public domain)')}
        ${row('OpenTopoMap', '© OpenStreetMap contributors, SRTM | map style © OpenTopoMap (CC-BY-SA)')}
        ${row('17(b) easements', 'Bureau of Land Management (BLM) Alaska, ANCSA 17(b) easements')}
        ${row('Roads & right-of-way', 'Alaska DOT&PF road centerlines; Kodiak Island Borough roads and parcels (ROW widths derived)')}
        ${row('Trails, parcels, ownership', 'Kodiak Island Borough GIS (KIB_Trails, KIB_Parcels, KIB_Ownership, KIB_Roads). No warranty.')}
        ${row('Fishing', 'ADF&G GoFishAK; NOAA ENC; ADF&G Kodiak fishing reports')}
        ${row('Tides', 'NOAA CO-OPS tide predictions')}
        ${row('Military history', 'kadiak.org (Kodiak Historical Army/Navy site) — old map sheets and history; field GPS points by Victor')}
        ${row('Logging roads & bike trails', 'Victor, kodiakking.com')}
        ${row('Places', 'Business, school and library listings as credited on each card')}
        ${row('Map engine', 'MapLibre GL JS (BSD-3-Clause); Open Sans glyphs (Apache 2.0); Oswald & Inter fonts (OFL)')}
      </table>
      <div class="linkrow"><a href="https://kodiakking.com/" target="_blank" rel="noopener">kodiakking.com</a><a href="https://github.com/ChiniakVictor/sovereign-apps/releases" target="_blank" rel="noopener">Get the Android app</a></div>`);
  };

  // ---------- find me (one-off) ----------
  function circle(lon, lat, r) {
    const pts = [], n = 48, dLat = r / 111320, dLon = r / (111320 * Math.cos(lat * Math.PI / 180));
    for (let i = 0; i <= n; i++) { const a = (i / n) * 2 * Math.PI; pts.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]); }
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts] }, properties: {} };
  }
  $('btnFind').onclick = () => {
    if (!('geolocation' in navigator)) { status('This browser cannot share its location.', 4000); return; }
    status('Finding you… (your position stays on this page)');
    navigator.geolocation.getCurrentPosition((pos) => {
      const { longitude: lon, latitude: lat, accuracy } = pos.coords;
      map.getSource('me').setData({ type: 'FeatureCollection', features: [circle(lon, lat, Math.min(accuracy || 30, 5000)), { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} }] });
      map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), accuracy > 1000 ? 11 : 14) });
      status(`You are here (±${Math.round(accuracy)} m). Not tracked or saved.`, 5000);
    }, (err) => status(err.code === 1 ? 'Location permission was denied.' : 'Could not get your location.', 5000), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  };

  init().catch((e) => status('Map failed to start: ' + e.message));
})();
