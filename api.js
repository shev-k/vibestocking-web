/* ============================================================
   VibeStocking Web — live market data service.
   Same sources as the mobile app (lib/data/api_service.dart):
   prices/history/stats from Yahoo Finance v8 chart/spark (keyless),
   marketstack as a price fallback, news from NewsAPI.

   Browsers block these endpoints with CORS, so every request is
   routed through a public CORS proxy. Several proxies are tried in
   order and the first that works is remembered. Every call is
   wrapped: on failure the UI falls back to the demo engine (data.js).

   NOTE: open the app over http:// (a local server), not file:// —
   from a file:// page the origin is "null" and proxies/fetch misbehave.
   ============================================================ */

const API = (() => {
  const MARKETSTACK_KEY = '89c05927e29b0ea7b966e7bfc854f395';
  const NEWS_KEY = '30af9311678e4cb1b5402410219b3518';
  const TIMEOUT = 14000;

  // CORS proxies, tried in order. The index that last worked is reused first.
  // The local server (serve.js) exposes /proxy and is the reliable default;
  // the public proxies are only fallbacks for when the app isn't served by it.
  const PROXIES = [
    (u) => '/proxy?url=' + encodeURIComponent(u),
    (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
    (u) => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u),
  ];
  let goodProxy = 0;

  const toD = (v) => { if (v == null) return null; const n = +v; return isNaN(n) ? null : n; };

  async function tryOne(purl){
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const r = await fetch(purl, {signal: ctrl.signal, headers:{'Accept':'application/json'}});
      if (!r.ok) return null;
      const txt = await r.text();
      if (!txt) return null;
      return JSON.parse(txt);
    } catch (_) { return null; }
    finally { clearTimeout(t); }
  }
  async function getJSON(url){
    for (let k = 0; k < PROXIES.length; k++){
      const idx = (goodProxy + k) % PROXIES.length;
      const j = await tryOne(PROXIES[idx](url));
      if (j !== null){ goodProxy = idx; return j; }
    }
    return null;
  }

  const yahooSym = (s) => (s === 'SIE' ? 'SIE.DE' : s);
  const YAHOO_INDEX = {SPX:'^GSPC',NDX:'^NDX',DJI:'^DJI',DAX:'^GDAXI',UKX:'^FTSE',NKY:'^N225'};
  const rangeFor = (tf) => ({
    '1D':{range:'1d',interval:'5m'}, '1W':{range:'5d',interval:'30m'},
    '1M':{range:'1mo',interval:'1d'}, '3M':{range:'3mo',interval:'1d'},
    '1Y':{range:'1y',interval:'1wk'},
  }[tf] || {range:'1mo',interval:'1d'});

  function sparkVals(closesArr){
    const spark = [];
    if (closesArr) for (const c of closesArr){ const d = toD(c); if (d != null) spark.push(d); }
    return spark;
  }

  // Batched quotes + sparklines for many Yahoo symbols in ONE call.
  // Returns { yahooSymbol: {level, pct, spark[]} }.
  async function sparkBatch(ylist){
    const out = {};
    if (!ylist.length) return out;
    const j = await getJSON(`https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(ylist.join(','))}&range=1d&interval=15m`);
    if (!j) return out;
    const res = j.spark && j.spark.result;
    if (res){
      for (const it of res){
        const sym = it.symbol;
        const r = (it.response && it.response[0]) || it;
        const meta = r.meta || {};
        const spark = sparkVals(r.indicators && r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close);
        const price = toD(meta.regularMarketPrice) ?? (spark.length ? spark[spark.length-1] : null);
        if (price == null) continue;
        const prev = toD(meta.chartPreviousClose) ?? toD(meta.previousClose) ?? (spark.length ? spark[0] : null);
        const pct = (prev && prev !== 0) ? (price - prev) / prev * 100 : 0;
        out[sym] = {level: price, pct, spark};
      }
      return out;
    }
    // Compact map format: { SYM: {close:[...], previousClose, chartPreviousClose, ...} }
    for (const sym in j){
      const r = j[sym];
      if (!r || !Array.isArray(r.close)) continue;
      const spark = sparkVals(r.close);
      const price = spark.length ? spark[spark.length-1] : null;
      if (price == null) continue;
      const prev = toD(r.chartPreviousClose) ?? toD(r.previousClose) ?? spark[0];
      const pct = (prev && prev !== 0) ? (price - prev) / prev * 100 : 0;
      out[sym] = {level: price, pct, spark};
    }
    return out;
  }

  // One intraday chart call -> {level, pct, spark} (per-symbol fallback).
  async function chartQuote(yahoo){
    const j = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${yahoo}?range=1d&interval=15m`);
    const result = j && j.chart && j.chart.result && j.chart.result[0];
    const meta = result && result.meta;
    if (!meta) return null;
    const spark = sparkVals(result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close);
    const price = toD(meta.regularMarketPrice) ?? (spark.length ? spark[spark.length-1] : null);
    if (price == null) return null;
    const prev = toD(meta.chartPreviousClose) ?? toD(meta.previousClose) ?? (spark.length ? spark[0] : null);
    const pct = (prev && prev !== 0) ? (price - prev) / prev * 100 : 0;
    return {level: price, pct, spark};
  }

  // Company quotes + sparks. Tries spark batch (1 call), then per-symbol chart,
  // then marketstack (price only) as a last resort.
  async function fetchQuotes(symbols){
    const out = {};
    if (!symbols.length) return out;
    const map = {}; const ylist = symbols.map(s => { const y = yahooSym(s); map[y] = s; return y; });
    const batch = await sparkBatch(ylist);
    for (const y in batch){ const s = map[y]; if (!s) continue; const b = batch[y];
      out[s] = {price:{price:b.level, changePct:b.pct}, spark:b.spark}; }
    if (Object.keys(out).length) return out;

    const res = await Promise.all(symbols.map(s => chartQuote(yahooSym(s))));
    symbols.forEach((s, i) => { const r = res[i]; if (r) out[s] = {price:{price:r.level, changePct:r.pct}, spark:r.spark}; });
    if (Object.keys(out).length) return out;

    const ms = await marketstackPrices(symbols);
    for (const k in ms) out[k] = {price: ms[k], spark: []};
    return out;
  }

  async function fetchIndexQuotes(indexSyms){
    const out = {}; const map = {}; const ylist = [];
    indexSyms.forEach(s => { const y = YAHOO_INDEX[s]; if (y){ map[y] = s; ylist.push(y); } });
    const batch = await sparkBatch(ylist);
    for (const y in batch){ const s = map[y]; if (!s) continue; const b = batch[y];
      out[s] = {level:b.level, changePct:b.pct, spark:b.spark}; }
    if (Object.keys(out).length) return out;

    const ys = Object.keys(map);
    const res = await Promise.all(ys.map(y => chartQuote(y)));
    ys.forEach((y, i) => { const r = res[i]; if (r) out[map[y]] = {level:r.level, changePct:r.pct, spark:r.spark}; });
    return out;
  }

  async function marketstackPrices(symbols){
    const out = {};
    const j = await getJSON(`https://api.marketstack.com/v1/eod/latest?access_key=${MARKETSTACK_KEY}&symbols=${symbols.join(',')}&limit=100`);
    const data = (j && j.data) || [];
    for (const m of data){
      const sym = (m.symbol || '').toString();
      const close = toD(m.close), open = toD(m.open);
      if (!sym || close == null) continue;
      const pct = (open && open !== 0) ? (close - open) / open * 100 : 0;
      out[sym] = {price: close, changePct: pct};
    }
    return out;
  }

  // Price history (closes + OHLC candles) for one timeframe.
  async function seriesFor(yahoo, tf){
    const r = rangeFor(tf);
    const j = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${yahoo}?range=${r.range}&interval=${r.interval}`);
    const result = j && j.chart && j.chart.result && j.chart.result[0];
    const q = result && result.indicators && result.indicators.quote && result.indicators.quote[0];
    if (!q || !q.close) return null;
    const closes = [], candles = [];
    for (let i=0;i<q.close.length;i++){
      const c = toD(q.close[i]); if (c == null) continue;
      closes.push(c);
      const o = toD(q.open && q.open[i]) ?? c, h = toD(q.high && q.high[i]) ?? c, l = toD(q.low && q.low[i]) ?? c;
      candles.push({open:o, high:h, low:l, close:c});
    }
    if (closes.length < 2) return null;
    return {closes, candles};
  }
  const seriesForCompany = (sym, tf) => seriesFor(yahooSym(sym), tf);
  const seriesForIndex   = (sym, tf) => { const y = YAHOO_INDEX[sym]; return y ? seriesFor(y, tf) : Promise.resolve(null); };

  // Real key statistics from the keyless Yahoo chart meta.
  // (Market cap / P-E / dividend yield need quoteSummary with a crumb+cookie,
  // not reliably reachable from the browser — those stay null -> UI shows '—'.)
  async function fetchStats(sym){
    const j = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym(sym)}?range=1d&interval=1d`);
    const result = j && j.chart && j.chart.result && j.chart.result[0];
    const meta = result && result.meta;
    const stats = {open:null,prevClose:null,dayHigh:null,dayLow:null,week52High:null,week52Low:null,volume:null,marketCap:null,pe:null,divYield:null};
    if (meta){
      stats.prevClose = toD(meta.chartPreviousClose) ?? toD(meta.previousClose);
      stats.dayHigh = toD(meta.regularMarketDayHigh);
      stats.dayLow = toD(meta.regularMarketDayLow);
      stats.week52High = toD(meta.fiftyTwoWeekHigh);
      stats.week52Low = toD(meta.fiftyTwoWeekLow);
      stats.volume = toD(meta.regularMarketVolume);
      stats.open = toD(meta.regularMarketOpen);
    }
    if (stats.open == null){
      const opens = result && result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].open;
      if (opens) for (const o of opens){ const d = toD(o); if (d != null){ stats.open = d; break; } }
    }
    return stats;
  }

  function parseArticles(body){
    const out = [];
    const articles = (body && body.articles) || [];
    const now = Date.now();
    for (const m of articles){
      const title = (m.title || '').toString();
      if (!title || title === '[Removed]') continue;
      const pub = Date.parse(m.publishedAt || '');
      const mins = isNaN(pub) ? 0 : Math.abs(Math.round((now - pub) / 60000));
      out.push({title, source:((m.source && m.source.name) || 'News').toString(),
        minsAgo:mins, url:(m.url || '').toString(), imageUrl:m.urlToImage || null, description:m.description || null});
    }
    return out;
  }
  async function fetchHeadlines(){
    const j = await getJSON(`https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=20&apiKey=${NEWS_KEY}`);
    return j ? parseArticles(j) : [];
  }
  async function fetchCompanyNews(query){
    const j = await getJSON(`https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=8&apiKey=${NEWS_KEY}`);
    return j ? parseArticles(j) : [];
  }

  return {fetchQuotes, fetchIndexQuotes, seriesForCompany, seriesForIndex, fetchStats, fetchHeadlines, fetchCompanyNews};
})();
