Kodiak Maps — web preview (static, no build step)
Open index.html through any static web server (e.g. `python3 -m http.server`), not file://.
Contents: index.html, assets/ (MapLibre GL JS 5.24.0 bundled locally, fonts, glyphs, styles, app.js), data/ (GeoJSON).
Parcels are geometry-only (one neutral id per parcel), lazy-loaded at zoom 13+. Land ownership ships category/agency only.
Base map tiles load live from basemap.nationalmap.gov (USGS) and tile.opentopomap.org. Nothing else is contacted; no analytics.
Not a survey; derived widths; no warranty.
