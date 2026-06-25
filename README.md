# VibeStocking — Web

A calm global-markets workspace, built with **native HTML / CSS / JavaScript** (no
frameworks). Mobile looks like the VibeStocking mobile app; desktop is a full-screen
dashboard (sidebar + multi-column layout).

Live market data comes from the same sources as the mobile app:

- **Prices, history, candles, key stats** — Yahoo Finance v8 chart/spark (keyless)
- **Price fallback** — marketstack
- **News** — NewsAPI (business headlines + per-ticker related news)

Browsers block these endpoints with CORS, so the included Node server doubles as a
CORS proxy — it fetches upstream server-side and returns the data to the page. When
the proxy isn't reachable the UI gracefully falls back to deterministic demo data.

## Run

```bash
node serve.js          # serves the site + CORS proxy on http://localhost:8000/
```

Then open **http://localhost:8000/**. (Open it over `http://`, not by double-clicking
`index.html` — a `file://` page can't reach the proxy.)

No build step, no dependencies — just static files plus a tiny `serve.js`.

## Files

```
index.html    markup + font/CSS/JS includes
styles.css    design tokens + components + responsive (mobile app / desktop dashboard)
data.js       universe data, deterministic demo chart math, SVG renderers, formatting
api.js        live data service (Yahoo / marketstack / NewsAPI via the local proxy)
app.js        SPA shell, live data store, screen rendering, interactions
serve.js      static file server + /proxy CORS proxy
```

## Screens

Markets · News · Portfolio · Upgrade (Pro) · Stock detail (area/candle chart with
tap-to-scrub price, key statistics, related news) · Auth · Search. Dark/light theme
and multi-currency (USD/EUR/GBP/JPY/CHF/AED) throughout.
