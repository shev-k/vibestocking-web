/* ============================================================
   VibeStocking Web — SPA shell, live data store and screen render.
   Mobile = faithful app UI; desktop = sidebar + focused content.
   Live values overlay the demo engine (data.js); charts are always
   from the API (loader / "unavailable" instead of mock curves).
   ============================================================ */

/* ---------- state ---------- */
const TABS=[['markets','Markets','Live global prices','chart'],
  ['news','News','Market headlines','article'],
  ['portfolio','Portfolio','Your positions','wallet'],
  ['pro','Upgrade','VibeStocking Pro','crown']];
let tab='markets';
const state={cur:'USD', theme:'dark', country:'US'};

const live={prices:{}, sparks:{}, idx:{}, headlines:[],
  loading:false, usingLive:false, fromCache:false, lastUpdated:null, error:null};

/* watchlist store (persisted) */
const WK='vs_web_watch_v1';
let watch=(()=>{try{const r=localStorage.getItem(WK);if(r)return JSON.parse(r);}catch(_){}return [...WATCHLIST];})();
function saveWatch(){try{localStorage.setItem(WK,JSON.stringify(watch));}catch(_){}}
const inWatch=s=>watch.includes(s);
function toggleWatch(s){ if(inWatch(s))watch=watch.filter(x=>x!==s); else watch=[s,...watch]; saveWatch(); return inWatch(s); }

const priceOf=co=>live.prices[co.sym]?live.prices[co.sym].price:co.price;
const pctOf=co=>live.prices[co.sym]?live.prices[co.sym].changePct:co.dPct;
const isLive=sym=>!!live.prices[sym];
const sparkOf=sym=>{const s=live.sparks[sym];return (s&&s.length>=2)?s:null;};
const idxQuote=sym=>live.idx[sym];
function statusLabel(){
  const n=Object.keys(live.prices).length;
  if(live.loading)return 'Updating…';
  if(live.usingLive&&!live.fromCache)return 'Live · Yahoo Finance ('+n+')';
  if(live.usingLive&&live.fromCache)return 'Cached prices ('+n+')';
  return 'Demo data';
}

/* ---- company logo chip (real logo with graceful fallback to letters) ---- */
const DOMAIN={NVDA:'nvidia.com',AAPL:'apple.com',MSFT:'microsoft.com',TSLA:'tesla.com',
  AMZN:'amazon.com',GOOGL:'google.com',META:'meta.com',AMD:'amd.com',JPM:'jpmorganchase.com',
  NFLX:'netflix.com',DIS:'disney.com',COIN:'coinbase.com',SAP:'sap.com',SIE:'siemens.com',
  ASML:'asml.com',SHEL:'shell.com',TM:'toyota.com',BABA:'alibaba.com'};
function chip(sym,size,radius,extra){
  const s=size||38, r=(radius!=null?radius:11), fs=s<30?'font-size:11px;':'';
  const fb=DOMAIN[sym]?` data-fb="https://logo.clearbit.com/${DOMAIN[sym]}"`:'';
  return `<div class="chip" style="width:${s}px;height:${s}px;border-radius:${r}px;${fs}background:${chipGrad(sym)};${extra||''}">`
    + `<span>${sym.slice(0,2)}</span>`
    + `<img class="logo" alt="" loading="lazy" src="https://assets.parqet.com/logos/symbol/${encodeURIComponent(sym)}?format=png&size=64"${fb}`
    + ` onload="this.classList.add('on')" onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.removeAttribute('data-fb');}else{this.remove();}"></div>`;
}

/* ---------- shared row ---------- */
function stockRow(co){const price=priceOf(co),pct=pctOf(co),up=pct>=0;const sp=sparkOf(co.sym);return `
  <div class="row" data-open="${co.sym}">
    ${chip(co.sym)}
    <div class="nm"><div class="s">${co.sym}</div><div class="n">${escapeHtml(co.name)}</div></div>
    <div class="spark">${sp?sparkSVG(sp):''}</div>
    <div class="px"><div class="p mono">${fmtPrice(price,state.cur)}</div>
      <div class="c mono ${up?'up-c':'down-c'}">${fmtPct(pct)}</div></div>
  </div>`;}

/* ================= SCREENS ================= */
function renderMarkets(){
  const ct=COUNTRIES.find(x=>x.code===state.country)||COUNTRIES[0];
  const hero=BYIDX[ct.index]||INDICES[0];
  const iq=idxQuote(hero.sym);
  const level=iq?iq.level:hero.base, hpct=iq?iq.changePct:hero.dPct;
  const hAbs=level-level/(1+hpct/100), hUp=hpct>=0;
  const others=INDICES.filter(i=>i.sym!==hero.sym).slice(0,2);
  const gainers=[...COMPANIES].sort((a,b)=>pctOf(b)-pctOf(a)).slice(0,4);
  const heroChart = (iq&&iq.spark.length>=2) ? areaSVG(iq.spark,320,88)
    : `<div class="chart-msg">${live.loading?spinner():'Chart unavailable'}</div>`;
  return `
  <div class="statusbar"><span class="d ${live.usingLive?'on':''}"></span><span>${statusLabel()}${live.lastUpdated?' · '+timeStr(live.lastUpdated):''}</span>
    <span class="refresh" data-act="refresh"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">${ICONS.refresh}</svg>Refresh</span></div>
  ${live.error?`<div class="errbar">${escapeHtml(live.error)}</div>`:''}
  <div class="chips">${COUNTRIES.map(c=>`<button class="cchip ${c.code===state.country?'active':''}" data-country="${c.code}">${c.flag} ${c.name}</button>`).join('')}</div>
  <div class="mk-grid">
    <div class="mk-left">
      <div class="hero">
        <div class="tag"><span class="dot"></span>Markets open · ${ct.flag} ${ct.market}</div>
        <div style="margin-top:12px;font-size:13px;font-weight:500;color:var(--text2)">${hero.name} · <span class="mono">${hero.sym}</span></div>
        <div class="big-num mono" style="margin-top:3px">${fmtNum(level,2)}</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
          <span class="pill ${hUp?'up':'down'}">${hUp?'▲':'▼'} ${fmtPct(hpct)}</span>
          <span class="mono ${hUp?'up-c':'down-c'}" style="font-size:13px;font-weight:600">${hAbs>=0?'+':''}${fmtNum(hAbs,2)} today</span>
        </div>
        <div style="height:88px;margin-top:14px">${heroChart}</div>
      </div>
      <div class="statgrid" style="margin-top:14px">${others.map(ix=>{const q=idxQuote(ix.sym);const lv=q?q.level:ix.base,p=q?q.changePct:ix.dPct,u=p>=0;return `
        <div class="stat"><div class="lab">${ix.name}</div><div class="val mono">${fmtNum(lv,0)}</div>
          <div class="mono ${u?'up-c':'down-c'}" style="font-size:12px;font-weight:600;margin-top:2px">${fmtPct(p)}</div></div>`;}).join('')}</div>
      <div class="sec-head">Top gainers <span class="pill up">▲ Live</span></div>
      <div class="card list">${gainers.map(stockRow).join('')}</div>
    </div>
    <div class="mk-right">
      <div class="sec-head">All stocks · ${ct.name}</div>
      <div class="card list">${COMPANIES.map(stockRow).join('')}</div>
    </div>
  </div>`;
}

function renderNews(){
  return live.headlines.length ? renderNewsLive(live.headlines) : renderNewsMock();
}
function renderNewsLive(arts){
  const feat=arts[0];
  const img=(a,h)=>`<div class="ph" style="height:${h}px">${a.imageUrl?`<img src="${escapeHtml(a.imageUrl)}" onerror="this.remove()" />`:''}</div>`;
  return `
  <div class="news-grid">
    <div class="card news-feat" data-url="${escapeHtml(feat.url)}" style="overflow:hidden">
      ${img(feat,170)}
      <div style="padding:14px">
        <div class="meta"><span class="tag">Top</span><span>${escapeHtml(feat.source)} · ${relTime(feat.minsAgo)}</span></div>
        <div style="margin-top:7px;font-size:15px;font-weight:600;line-height:1.35">${escapeHtml(feat.title)}</div>
        ${feat.description?`<div style="margin-top:6px;font-size:12px;color:var(--text2);line-height:1.4">${escapeHtml(feat.description)}</div>`:''}
        <div style="margin-top:10px;color:var(--brand);font-size:12px;font-weight:600">Read on ${escapeHtml(feat.source)} ↗</div>
      </div>
    </div>
    <div class="news-list">
      ${arts.slice(1).map(a=>`
      <div class="card" data-url="${escapeHtml(a.url)}" style="padding:11px;display:flex;gap:12px">
        <div style="width:74px;height:64px;border-radius:9px;overflow:hidden;flex:none">${img(a,64)}</div>
        <div style="flex:1;min-width:0">
          <div class="meta"><span class="tag">${escapeHtml(a.source)}</span><span>${relTime(a.minsAgo)}</span></div>
          <div style="margin-top:5px;font-size:13px;font-weight:600;line-height:1.35">${escapeHtml(a.title)}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}
function renderNewsMock(){
  const feat=NEWS[0],fco=BYSYM[feat.sym],fup=pctOf(fco)>=0;
  return `
  <div class="chips">${COMPANIES.slice(0,6).map(c=>{const u=pctOf(c)>=0;return `
    <button class="cchip" data-open="${c.sym}">${chip(c.sym,22,7,'margin-right:6px')}${c.sym} <span class="mono ${u?'up-c':'down-c'}" style="margin-left:6px">${fmtPct(pctOf(c))}</span></button>`;}).join('')}</div>
  <div class="news-grid" style="margin-top:14px">
    <div class="card news-feat" data-open="${feat.sym}" style="overflow:hidden">
      <div class="ph" style="height:150px"></div>
      <div style="padding:14px">
        <div class="meta"><span class="tag">${feat.tag}</span><span>${feat.src} · ${relTime(feat.mins)}</span></div>
        <div style="margin-top:7px;font-size:15px;font-weight:600;line-height:1.35">${escapeHtml(feat.title)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:12px">
          ${chip(feat.sym,26,8)}
          <span style="font-size:13px;font-weight:600">${feat.sym}</span>
          <span class="mono" style="font-size:13px">${fmtPrice(priceOf(fco),state.cur)}</span>
          <span class="pill ${fup?'up':'down'}">${fmtPct(pctOf(fco))}</span>
        </div>
      </div>
    </div>
    <div class="news-list">
      ${NEWS.slice(1).map(n=>{const co=BYSYM[n.sym],u=pctOf(co)>=0;return `
      <div class="card" data-open="${n.sym}" style="padding:11px;display:flex;gap:12px">
        <div class="ph" style="width:74px;height:64px;border-radius:9px;flex:none"></div>
        <div style="flex:1;min-width:0">
          <div class="meta"><span class="tag">${n.tag}</span><span>${relTime(n.mins)}</span></div>
          <div style="margin-top:5px;font-size:13px;font-weight:600;line-height:1.35">${escapeHtml(n.title)}</div>
          <div style="margin-top:7px;display:flex;gap:7px;align-items:center"><span style="font-size:12px;font-weight:600">${n.sym}</span>
            <span class="mono ${u?'up-c':'down-c'}" style="font-size:12px;font-weight:600">${fmtPct(pctOf(co))}</span></div>
        </div>
      </div>`;}).join('')}
    </div>
  </div>`;
}

function renderPortfolio(){
  let value=0,cost=0,day=0;const hold=PORTFOLIO.map(h=>{const co=BYSYM[h.sym];const px=priceOf(co);const val=px*h.shares;
    value+=val;cost+=h.avg*h.shares; const dAbs=isLive(co.sym)?px*pctOf(co)/100:co.dAbs; day+=dAbs*h.shares; return {h,co,val,px};});
  const gain=value-cost,gpct=cost?gain/cost*100:0,dpct=(value-day)?day/(value-day)*100:0;
  const dUp=day>=0,gUp=gain>=0;
  return `
  <div class="pf-grid">
    <div class="hero" style="padding:20px">
      <div class="t3" style="font-size:12px">Total portfolio value</div>
      <div class="big-num mono" style="margin-top:4px">${fmtPrice(value,state.cur)}</div>
      <div class="mono ${dUp?'up-c':'down-c'}" style="font-size:13px;font-weight:600;margin-top:6px">${dUp?'▲':'▼'} ${fmtPrice(Math.abs(day),state.cur)} (${fmtPct(dpct)}) today</div>
      <div style="height:9px;border-radius:999px;overflow:hidden;display:flex;margin-top:14px">
        ${hold.map(x=>`<div style="flex:${Math.round(x.val/value*1000)};background:${chipGrad(x.co.sym)}"></div>`).join('')}
      </div>
    </div>
    <div class="statgrid pf-stats">
      <div class="stat"><div class="lab">Total gain / loss</div>
        <div class="val mono ${gUp?'up-c':'down-c'}">${gUp?'+':'−'}${fmtPrice(Math.abs(gain),state.cur)}</div>
        <div class="mono ${gUp?'up-c':'down-c'}" style="font-size:12px;font-weight:600;margin-top:2px">${fmtPct(gpct)}</div></div>
      <div class="stat"><div class="lab">Invested</div><div class="val mono">${fmtPrice(cost,state.cur)}</div>
        <div class="t3" style="font-size:12px;margin-top:2px">${PORTFOLIO.length} positions</div></div>
      <div class="stat"><div class="lab">Buying power</div><div class="val mono">${fmtPrice(12480,state.cur)}</div></div>
      <div class="stat" data-toast="Deposit flow — demo" style="display:flex;align-items:center;justify-content:center"><span style="color:var(--brand);font-weight:600;font-size:14px">+ Deposit funds</span></div>
    </div>
  </div>
  <div class="sec-head">Holdings <span class="link" data-toast="Add position — demo">+ Add</span></div>
  <div class="card list holds">${hold.map(x=>{const g=(x.px-x.h.avg)*x.h.shares;const gp=(x.px-x.h.avg)/x.h.avg*100;const w=g>=0;return `
    <div class="row" data-open="${x.co.sym}">
      ${chip(x.co.sym)}
      <div class="nm"><div class="s">${x.co.sym}</div><div class="n">${x.h.shares} sh · avg ${fmtPrice(x.h.avg,state.cur)}</div></div>
      <div class="px"><div class="p mono">${fmtPrice(x.val,state.cur)}</div>
        <div class="c mono ${w?'up-c':'down-c'}">${w?'+':'−'}${fmtPrice(Math.abs(g),state.cur)}</div></div>
      <div class="pct mono ${w?'up-c':'down-c'}">${fmtPct(gp)}</div>
    </div>`;}).join('')}</div>
  <div class="sec-head">Watchlist <span class="t3" style="font-size:11px">tap to open</span></div>
  ${watch.length? `<div class="card list">${watch.map(sym=>{const co=BYSYM[sym];if(!co)return '';const u=pctOf(co)>=0;const sp=sparkOf(sym);return `
    <div class="row" data-open="${sym}">
      ${chip(sym)}
      <div class="nm"><div class="s">${sym}</div><div class="n">${escapeHtml(co.name)}</div></div>
      <div class="spark">${sp?sparkSVG(sp):''}</div>
      <div class="px"><div class="p mono">${fmtPrice(priceOf(co),state.cur)}</div>
        <div class="c mono ${u?'up-c':'down-c'}">${fmtPct(pctOf(co))}</div></div>
      <button class="wl-x" data-watchremove="${sym}" title="Remove">×</button>
    </div>`;}).join('')}</div>`
  : `<div class="card" style="padding:18px;text-align:center;color:var(--text3);font-size:13px">No symbols yet — add some from a stock page.</div>`}`;
}

const PLANS=[
 ['Basic',0,0,'Current plan',['Real-time quotes (15-min delay)','10 watchlist symbols','1 portfolio'],false],
 ['Pro',14,11,'Upgrade to Pro',['Real-time streaming quotes','Unlimited watchlists & alerts','5 portfolios + analytics','Advanced charting & indicators','Level II market depth'],true],
 ['Desk',39,32,'Contact sales',['Everything in Pro','API access & data exports','Multi-seat team workspace','Dedicated account manager'],false]];
let proAnnual=true;
function renderPro(){
  return `
  <div style="text-align:center;max-width:560px;margin:0 auto">
    <div style="font-size:11px;font-weight:600;color:var(--brand);letter-spacing:1.1px">VIBESTOCKING PRO</div>
    <div style="font-size:26px;font-weight:700;line-height:1.12;letter-spacing:-.02em;margin-top:8px">Upgrade to a deeper market view.</div>
    <div style="font-size:13px;color:var(--text2);line-height:1.5;margin-top:8px">Streaming quotes, unlimited watchlists and pro-grade charting. Cancel anytime.</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:9px;margin-top:14px">
      <span style="font-size:13px;color:${proAnnual?'var(--text3)':'var(--text)'}">Monthly</span>
      <div class="switch ${proAnnual?'on':''}" data-act="billing"><div class="knob"></div></div>
      <span style="font-size:13px;color:${proAnnual?'var(--text)':'var(--text3)'}">Annual</span>
      <span class="pill up">−22%</span>
    </div>
  </div>
  <div class="plan-grid">
  ${PLANS.map(p=>{const[name,m,y,cta,feats,feat]=p;return `
    <div class="plan ${feat?'feat':''}">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:15px;font-weight:700">${name}</span>
        ${feat?'<span class="pill" style="background:var(--brand);color:#fff">Popular</span>':''}
      </div>
      <div class="price mono" style="margin-top:8px">${m===0?'Free':'$'+(proAnnual?y:m)+'<span class="t3" style="font-size:13px">/mo</span>'}</div>
      <div class="btn ${feat?'btn-brand':'btn-ghost'}" style="margin-top:8px" data-toast="${name==='Basic'?"You're on Basic":name==='Desk'?'Sales will reach out':'Upgrading to Pro'}">${cta}</div>
      <div style="height:12px"></div>
      ${feats.map(f=>`<div class="feat-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5 9-11"/></svg><span>${f}</span></div>`).join('')}
    </div>`;}).join('')}
  </div>
  <div style="text-align:center;color:var(--text3);font-size:12px;margin-top:6px">30-day money-back guarantee</div>`;
}

/* ================= DETAIL (live) ================= */
const detail={sym:'NVDA', tf:'1D', type:0, side:'buy', shares:10, _closes:null, series:{}, stats:undefined, news:undefined};
function openDetail(sym){
  detail.sym=sym; detail.tf='1D'; detail.type=0; detail.side='buy'; detail.shares=10; detail._closes=null;
  detail.series={}; detail.stats=undefined; detail.news=undefined;
  showOverlay('detail'); renderDetail();
  // fire async live fetches
  API.fetchStats(sym).then(s=>{detail.stats=s||null; if(overlayOpen('detail'))renderDetail();});
  const co=BYSYM[sym];
  API.fetchCompanyNews(co?co.name:sym).then(a=>{ detail.news=(a&&a.length)?a:(live.headlines.length?live.headlines:null); if(overlayOpen('detail'))renderDetail();});
  ensureSeries(detail.tf);
}
function ensureSeries(tf){
  if(detail.series[tf]!==undefined) return;
  detail.series[tf]='loading';
  API.seriesForCompany(detail.sym,tf).then(b=>{ detail.series[tf]=b||null; if(overlayOpen('detail')&&detail.tf===tf)renderDetail(); });
}
function renderDetail(){
  const co=BYSYM[detail.sym];const price=priceOf(co),pct=pctOf(co),up=pct>=0;
  const dAbs=isLive(co.sym)?price*pct/100:co.dAbs;
  const bars=detail.series[detail.tf];
  if(bars===undefined)ensureSeries(detail.tf);
  // chart
  let chartInner, periodHtml, isArea=false;
  detail._closes=null;
  if(bars===undefined||bars==='loading'){chartInner=`<div class="chart-msg">${spinner()}</div>`;periodHtml=miniStats(null);}
  else if(bars===null){chartInner=`<div class="chart-msg">Chart unavailable — check your connection</div>`;periodHtml=miniStats(null);}
  else if(detail.type===1){chartInner=candleBarsSVG(bars.candles,60,320,160);periodHtml=miniStats(bars.closes);}
  else { isArea=true; detail._closes=bars.closes;
    chartInner=areaSVG(bars.closes,320,160)+`<div class="cross" id="detCross"><div class="cdot"></div></div><div class="crosslabel" id="detLabel"></div>`;
    periodHtml=miniStats(bars.closes); }
  const chartHtml=`<div class="chartwrap"><div class="chartbox${isArea?' ichart':''}" id="detChart">${chartInner}</div></div>`;
  // key stats
  const st=detail.stats;
  let kvHtml;
  if(st===undefined)kvHtml=`<div class="chart-msg" style="height:90px">Loading statistics…</div>`;
  else { const px=v=>v==null?'—':fmtPrice(v,state.cur);
    const kv=[['Open',px(st&&st.open)],['Prev Close',px(st&&st.prevClose)],['Day Low',px(st&&st.dayLow)],['Day High',px(st&&st.dayHigh)],
      ['52W Low',px(st&&st.week52Low)],['52W High',px(st&&st.week52High)],
      ['Volume',(st&&st.volume!=null)?fmtVol(st.volume):'—'],['Mkt Cap',(st&&st.marketCap!=null)?fmtMcap(st.marketCap/1e9,state.cur):'—'],
      ['P/E',(st&&st.pe!=null)?st.pe.toFixed(1):'—'],['Div Yield',(st&&st.divYield!=null)?st.divYield.toFixed(2)+'%':'—']];
    kvHtml=`<div class="kv">${kv.map(r=>`<div><div class="lab">${r[0]}</div><div class="val mono">${r[1]}</div></div>`).join('')}</div>`; }
  // related news
  let newsHtml;
  if(detail.news===undefined)newsHtml=`<div class="card" style="padding:18px;text-align:center;color:var(--text3);font-size:12px">Loading related news…</div>`;
  else if(!detail.news||!detail.news.length)newsHtml=`<div class="card" style="padding:18px;text-align:center;color:var(--text3);font-size:12px">No related news right now</div>`;
  else newsHtml=`<div class="card" style="padding:0 14px">${detail.news.slice(0,4).map((n,i)=>`
    <div ${n.url?`data-url="${escapeHtml(n.url)}"`:''} style="padding:12px 0;${i>0?'border-top:1px solid var(--line)':''}">
      <div class="meta"><span class="tag">News</span><span>${escapeHtml(n.source||n.src||'News')} · ${relTime(n.minsAgo!=null?n.minsAgo:n.mins)}</span></div>
      <div style="margin-top:5px;font-size:13px;font-weight:600;line-height:1.4">${escapeHtml(n.title)}</div>
    </div>`).join('')}</div>`;

  document.getElementById('detailBody').innerHTML=`
  <div class="page-pad">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
    <button class="iconbtn" data-close="detail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ICONS.back}</svg></button>
    <div style="flex:1;font-size:17px;font-weight:700">${co.sym}${isLive(co.sym)?' <span class="pill up" style="font-size:10px">LIVE</span>':''}</div>
    <div class="cur-pick">${CUR[state.cur][0]} ${state.cur}</div>
  </div>
  <div style="display:flex;align-items:center;gap:12px;margin-top:6px">
    ${chip(co.sym,46,13)}
    <div><div style="font-size:17px;font-weight:700">${escapeHtml(co.name)}</div>
      <div style="font-size:11px;color:var(--text3)"><span class="mono">${co.sym}</span> · ${co.exch} · ${co.sector}</div></div>
  </div>
  <div style="margin-top:14px"><span class="mono" style="font-size:36px;font-weight:600;letter-spacing:-.02em">${fmtPrice(price,state.cur)}</span></div>
  <div class="${up?'up-c':'down-c'}" style="font-size:14px;font-weight:600;margin-top:2px">${dAbs>=0?'+':''}${fmtPrice(Math.abs(dAbs),state.cur)} (${fmtPct(pct)}) today</div>
  ${chartHtml}
  <a class="weblink" href="https://finance.yahoo.com/quote/${co.sym}" target="_blank" rel="noopener">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">${ICONS.open}</svg> Open full chart on Yahoo Finance</a>
  <div style="display:flex;gap:8px;align-items:center;margin-top:12px">
    <div class="seg" style="flex:1">${TFO.map(t=>`<button class="${t===detail.tf?'active':''}" data-tf="${t}">${t}</button>`).join('')}</div>
    <div class="seg icons" style="width:92px">
      <button class="${detail.type===0?'active':''}" data-type="0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l5-6 4 3 6-8"/></svg></button>
      <button class="${detail.type===1?'active':''}" data-type="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="7" width="3" height="10"/><path d="M7.5 4v3M7.5 17v3"/><rect x="15" y="9" width="3" height="7"/><path d="M16.5 6v3M16.5 16v2"/></svg></button>
    </div>
  </div>
  ${periodHtml}
  <div class="sec-head">Key statistics</div>
  ${kvHtml}
  <div class="sec-head">Related news</div>
  ${newsHtml}
  <div style="height:16px"></div>
  <div class="card" style="padding:16px">
    <div class="tabsel">
      <button data-side="buy" style="${detail.side==='buy'?'background:var(--surface);color:var(--up)':'color:var(--text2)'}">Buy</button>
      <button data-side="sell" style="${detail.side==='sell'?'background:var(--surface);color:var(--down)':'color:var(--text2)'}">Sell</button>
    </div>
    <div style="margin:14px 0 7px;font-size:12px;font-weight:500;color:var(--text2)">Shares</div>
    <input class="field" id="detShares" type="number" min="0" step="1" value="${detail.shares}" />
    <div style="display:flex;justify-content:space-between;margin:8px 0;font-size:13px"><span class="t2">Estimated ${detail.side==='buy'?'cost':'proceeds'}</span><span class="mono" id="detEstimate">${fmtPrice(price*(detail.shares||0),state.cur)}</span></div>
    <div class="btn" data-act="trade" style="${detail.side==='buy'?'background:var(--brand);color:#fff':'background:var(--down);color:#fff'}">${detail.side==='buy'?'Buy':'Sell'} ${co.sym}</div>
    <div style="height:8px"></div>
    <div class="btn btn-ghost" data-act="watch" style="${inWatch(co.sym)?'border-color:var(--brand);color:var(--brand);background:var(--brand-soft)':''}">${inWatch(co.sym)?'✓ In watchlist':'+ Add to watchlist'}</div>
  </div>
  </div>`;
  wireChart();
}

/* Interactive crosshair on the detail area chart: tap/drag to read the
   price at any point (mirrors the mobile InteractiveAreaChart). */
function wireChart(){
  const box=document.getElementById('detChart');
  if(!box || !box.classList.contains('ichart')) return;
  const closes=detail._closes;
  if(!closes || closes.length<2) return;
  const cross=document.getElementById('detCross');
  const dot=cross&&cross.querySelector('.cdot');
  const label=document.getElementById('detLabel');
  if(!cross||!label) return;
  const up=closes[closes.length-1]>=closes[0];
  const col=up?'var(--up)':'var(--down)';
  cross.style.borderColor=col; if(dot)dot.style.background=col; label.style.color=col;
  const mn=Math.min(...closes),mx=Math.max(...closes),range=(mx-mn)||1;
  let active=false;
  function at(clientX){
    const r=box.getBoundingClientRect();
    let f=(clientX-r.left)/r.width; f=Math.max(0,Math.min(1,f));
    const i=Math.round(f*(closes.length-1));
    const x=i/(closes.length-1)*r.width;
    const pad=8/220*r.height, innerH=r.height-pad*2;
    const y=pad+innerH-((closes[i]-mn)/range)*innerH;
    cross.style.display='block'; cross.style.left=x+'px';
    if(dot)dot.style.top=y+'px';
    label.style.display='block'; label.textContent=fmtPrice(closes[i],state.cur);
    const lw=label.offsetWidth||90; label.style.left=Math.max(0,Math.min(r.width-lw,x-lw/2))+'px';
  }
  function end(){active=false;cross.style.display='none';label.style.display='none';}
  box.addEventListener('pointerdown',e=>{active=true;try{box.setPointerCapture(e.pointerId);}catch(_){}at(e.clientX);e.preventDefault();});
  box.addEventListener('pointermove',e=>{ if(active||e.pointerType==='mouse') at(e.clientX); });
  box.addEventListener('pointerup',end);
  box.addEventListener('pointercancel',end);
  box.addEventListener('pointerleave',()=>{ if(!active) end(); else end(); });
}
function miniStats(closes){
  if(!closes){return `<div class="ministats"><div><div class="t3" style="font-size:11px">Period</div><div class="mono" style="font-size:14px;font-weight:600">—</div></div>
    <div><div class="t3" style="font-size:11px">High</div><div class="mono" style="font-size:14px;font-weight:600">—</div></div>
    <div><div class="t3" style="font-size:11px">Low</div><div class="mono" style="font-size:14px;font-weight:600">—</div></div></div>`;}
  const periodPct=(closes[closes.length-1]-closes[0])/closes[0]*100;const hi=Math.max(...closes),lo=Math.min(...closes);
  return `<div class="ministats"><div><div class="t3" style="font-size:11px">Period</div><div class="mono ${periodPct>=0?'up-c':'down-c'}" style="font-size:14px;font-weight:600">${fmtPct(periodPct)}</div></div>
    <div><div class="t3" style="font-size:11px">High</div><div class="mono" style="font-size:14px;font-weight:600">${fmtPrice(hi,state.cur)}</div></div>
    <div><div class="t3" style="font-size:11px">Low</div><div class="mono" style="font-size:14px;font-weight:600">${fmtPrice(lo,state.cur)}</div></div></div>`;
}

/* ================= AUTH ================= */
// Decorative "markets hero" banner (inline SVG, brand-styled).
function heroBanner(){
  let bars=''; for(let i=0;i<26;i++){const x=12+i*15.2;const h=7+((i*53)%22);bars+=`<rect x="${x.toFixed(1)}" y="${(152-h).toFixed(1)}" width="7" height="${h}" rx="2"/>`;}
  const line='M0 122 C40 114 62 120 92 102 C122 86 150 98 182 80 C216 60 250 72 286 54 C322 38 356 46 400 30';
  return `<div class="authhero"><svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="hb-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563EB"/><stop offset=".55" stop-color="#13235e"/><stop offset="1" stop-color="#0a0f1c"/></linearGradient>
      <linearGradient id="hb-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#93c5fd" stop-opacity=".5"/><stop offset="1" stop-color="#93c5fd" stop-opacity="0"/></linearGradient>
      <radialGradient id="hb-glow" cx="78%" cy="-10%" r="80%"><stop offset="0" stop-color="#3b82f6" stop-opacity=".55"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="400" height="160" fill="url(#hb-bg)"/>
    <rect width="400" height="160" fill="url(#hb-glow)"/>
    <g stroke="rgba(255,255,255,.06)" stroke-width="1"><line x1="0" y1="40" x2="400" y2="40"/><line x1="0" y1="80" x2="400" y2="80"/><line x1="0" y1="120" x2="400" y2="120"/></g>
    <g fill="rgba(255,255,255,.07)">${bars}</g>
    <path d="${line} L400 160 L0 160 Z" fill="url(#hb-area)"/>
    <path d="${line}" fill="none" stroke="#bfdbfe" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="400" cy="30" r="4.5" fill="#fff"/><circle cx="400" cy="30" r="9" fill="#fff" opacity=".2"/>
    <text x="18" y="32" fill="#fff" font-family="IBM Plex Sans,sans-serif" font-size="14" font-weight="700">Global markets, one calm view</text>
    <g transform="translate(18,42)"><rect width="66" height="20" rx="10" fill="rgba(22,199,132,.22)"/>
      <text x="33" y="14" text-anchor="middle" fill="#16C784" font-family="IBM Plex Mono,monospace" font-size="11" font-weight="700">▲ 2.41%</text></g>
  </svg></div>`;
}
let authReg=false;
function renderAuth(){
  document.getElementById('authBody').innerHTML=`<div class="page-pad">
  <button class="iconbtn" data-close="auth"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ICONS.back}</svg></button>
  ${heroBanner()}
  <div style="display:flex;align-items:center;gap:9px;margin-top:24px">
    <div class="logomark"><span style="height:7px;opacity:.55"></span><span style="height:12px;opacity:.78"></span><span style="height:16px"></span></div>
    <span style="font-size:19px;font-weight:700;letter-spacing:-.02em">Vibe<span style="color:var(--brand)">Stocking</span></span>
  </div>
  <div style="font-size:25px;font-weight:700;letter-spacing:-.02em;margin-top:28px">${authReg?'Create account':'Welcome back'}</div>
  <div class="t2" style="font-size:14px;margin-top:6px">${authReg?'Track global markets in under a minute.':'Sign in to your VibeStocking workspace.'}</div>
  <div style="height:22px"></div>
  <div class="tabsel"><button data-authmode="0" style="${!authReg?'background:var(--surface);color:var(--text)':'color:var(--text2)'}">Sign in</button><button data-authmode="1" style="${authReg?'background:var(--surface);color:var(--text)':'color:var(--text2)'}">Register</button></div>
  <div style="display:flex;gap:10px;margin-top:20px">
    <div class="btn btn-ghost" style="flex:1" data-toast="Continue with Google"><span style="color:#4285F4;font-weight:700;margin-right:7px">G</span>Google</div>
    <div class="btn btn-ghost" style="flex:1" data-toast="Continue with Apple"> Apple</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;margin:18px 0;color:var(--text3);font-size:11px"><div style="flex:1;height:1px;background:var(--line)"></div>or with email<div style="flex:1;height:1px;background:var(--line)"></div></div>
  ${authReg?'<div class="flab">Full name</div><input class="field" placeholder="Alex Trader" style="margin-bottom:14px"/>':''}
  <div class="flab">Email</div><input class="field" placeholder="you@email.com" style="margin-bottom:14px"/>
  <div class="flab">Password</div><input class="field" type="password" placeholder="••••••••" style="margin-bottom:10px"/>
  ${!authReg?'<div style="text-align:right;color:var(--brand);font-size:13px;font-weight:600">Forgot password?</div>':''}
  <div style="height:10px"></div>
  <div class="btn btn-brand" data-toast="${authReg?'Account created — welcome!':'Signed in'}">${authReg?'Create account':'Sign in'}</div>
  <div style="text-align:center;margin-top:18px;font-size:12px;color:var(--text3)" data-authtoggle>${authReg?'Already a member? ':'New here? '}<span style="color:var(--brand);font-weight:600">${authReg?'Sign in':'Create one'}</span></div>
  </div>`;
}

/* ================= SEARCH ================= */
let searchQ='';
function renderSearch(){
  const q=searchQ.trim().toLowerCase();
  const cos=q?COMPANIES.filter(c=>c.sym.toLowerCase().startsWith(q)||c.name.toLowerCase().includes(q)||c.sector.toLowerCase().includes(q)):[];
  document.getElementById('searchBody').innerHTML=`<div class="page-pad">
  <div style="display:flex;align-items:center;gap:10px">
    <div class="cur-pick" style="flex:1;height:44px;font-family:inherit;font-weight:400"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--text3)" stroke-width="2" style="margin-right:6px">${ICONS.search}</svg>
      <input id="searchInput" style="border:none;background:none;outline:none;color:var(--text);font-size:15px;width:100%" placeholder="Search stocks, sectors…" value="${escapeHtml(searchQ)}" /></div>
    <button class="link" data-close="search" style="color:var(--brand);font-weight:600">Cancel</button>
  </div>
  <div style="height:16px"></div>
  ${q? (cos.length?`<div class="card list">${cos.map(stockRow).join('')}</div>`:`<div class="t3" style="text-align:center;padding:40px 0">No matches for “${escapeHtml(searchQ)}”.</div>`)
     : `<div class="t3" style="text-align:center;padding:40px 0">Type to search the universe — try “sem”, “NVDA”, or “bank”.</div>`}
  </div>`;
  const si=document.getElementById('searchInput'); if(si){si.focus();si.setSelectionRange(searchQ.length,searchQ.length);}
}

/* ================= shell / chrome ================= */
function spinner(){return `<span class="spin"></span>`;}
function timeStr(d){return d.toTimeString().slice(0,5);}
function navHtml(kind){return TABS.map(t=>`<button class="navbtn ${t[0]===tab?'active':''}" data-tab="${t[0]}">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ICONS[t[3]]}</svg><span>${t[1]}</span></button>`).join('');}

function renderChrome(){
  const meta=TABS.find(t=>t[0]===tab);
  document.getElementById('sideNav').innerHTML=navHtml('side');
  document.getElementById('tabbar').innerHTML=navHtml('bottom');
  document.getElementById('sideStatus').innerHTML=`<span class="d ${live.usingLive?'on':''}"></span><span>${statusLabel()}</span>`;
  document.getElementById('appbar').innerHTML=`
    <div class="ab-titles"><h1>${meta[1]}</h1><div class="sub">${meta[2]}</div></div>
    <div class="ab-actions">
      <button class="iconbtn" data-act="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ICONS.search}</svg></button>
      <div class="cur-ct" id="curCt">
        <button class="cur-btn" data-act="curtoggle"><span>${CUR[state.cur][0]} ${state.cur}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button>
        <div class="cur-menu" id="curMenu">
          ${Object.keys(CUR).map(c=>`<button class="cur-opt ${c===state.cur?'sel':''}" data-cur="${c}">
            <span class="mono">${CUR[c][0]} ${c}</span><span class="t3">${CUR[c][2]}</span></button>`).join('')}
        </div>
      </div>
      <button class="iconbtn" data-act="theme"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${state.theme==='dark'?ICONS.sun:ICONS.moon}</svg></button>
      <button class="iconbtn" data-act="user"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ICONS.user}</svg></button>
    </div>`;
}
function renderContent(){
  const el=document.getElementById('content');
  let html='';
  if(tab==='markets')html=renderMarkets();
  else if(tab==='news')html=renderNews();
  else if(tab==='portfolio')html=renderPortfolio();
  else if(tab==='pro')html=renderPro();
  el.innerHTML=`<div class="page">${html}</div>`;
}
function render(){ renderChrome(); renderContent(); if(overlayOpen('detail'))renderDetail(); }

/* overlays */
function showOverlay(id){document.getElementById('ov-'+id).classList.add('open');document.body.classList.add('noscroll');}
function hideOverlay(id){document.getElementById('ov-'+id).classList.remove('open');document.body.classList.remove('noscroll');}
function overlayOpen(id){return document.getElementById('ov-'+id).classList.contains('open');}

let toastT;
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),1700);}

/* ================= live refresh + cache ================= */
const CK='vs_web_cache_v1';
function saveCache(){ try{ localStorage.setItem(CK, JSON.stringify({prices:live.prices,sparks:live.sparks,idx:live.idx,t:Date.now()})); }catch(_){}}
function loadCache(){ try{ const raw=localStorage.getItem(CK); if(!raw)return; const c=JSON.parse(raw);
  if(c.prices&&Object.keys(c.prices).length){live.prices=c.prices;live.sparks=c.sparks||{};live.idx=c.idx||{};live.usingLive=true;live.fromCache=true;live.lastUpdated=c.t?new Date(c.t):null;} }catch(_){}}

async function refresh(){
  if(live.loading)return; live.loading=true; live.error=null; render();
  try{
    const syms=COMPANIES.map(c=>c.sym);
    const q=await API.fetchQuotes(syms);
    if(Object.keys(q).length){ live.prices={};live.sparks={};
      for(const s in q){live.prices[s]=q[s].price; if(q[s].spark&&q[s].spark.length>=2)live.sparks[s]=q[s].spark;}
      live.usingLive=true; live.fromCache=false; live.lastUpdated=new Date(); saveCache();
    } else if(!live.usingLive){ live.error='No live prices (offline / CORS / API limit) — showing demo data'; }
    const ix=await API.fetchIndexQuotes(INDICES.map(i=>i.sym)); if(Object.keys(ix).length)live.idx=ix;
    const news=await API.fetchHeadlines(); if(news.length)live.headlines=news;
  }catch(e){ if(!live.usingLive)live.error='Network error — showing demo data'; }
  finally{ live.loading=false; render(); }
}

/* ================= events ================= */
function bindEvents(){
  document.addEventListener('click',e=>{
    // close the currency menu on any outside click
    const menu=document.getElementById('curMenu');
    if(menu&&menu.classList.contains('open')&&!e.target.closest('#curCt')) menu.classList.remove('open');

    const t=e.target.closest('[data-tab],[data-act],[data-open],[data-url],[data-toast],[data-close],[data-country],[data-tf],[data-type],[data-authmode],[data-authtoggle],[data-cur],[data-side],[data-watchremove]');
    if(!t)return;
    if(t.dataset.tab){tab=t.dataset.tab;document.getElementById('content').scrollTop=0;render();return;}
    if(t.dataset.act==='theme'){state.theme=state.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=state.theme;render();return;}
    if(t.dataset.act==='curtoggle'){const m=document.getElementById('curMenu');if(m)m.classList.toggle('open');return;}
    if(t.dataset.cur){state.cur=t.dataset.cur;render();return;}
    if(t.dataset.act==='search'){searchQ='';renderSearch();showOverlay('search');return;}
    if(t.dataset.act==='user'){renderAuth();showOverlay('auth');return;}
    if(t.dataset.act==='refresh'){refresh();return;}
    if(t.dataset.act==='billing'){proAnnual=!proAnnual;render();return;}
    if(t.dataset.act==='trade'){const co=BYSYM[detail.sym];const n=detail.shares||0;
      toast(`${detail.side==='buy'?'Bought':'Sold'} ${n} ${co.sym}`);return;}
    if(t.dataset.act==='watch'){const added=toggleWatch(detail.sym);renderDetail();toast(added?`${detail.sym} added to watchlist`:`${detail.sym} removed from watchlist`);return;}
    if(t.dataset.watchremove){toggleWatch(t.dataset.watchremove);render();toast(`${t.dataset.watchremove} removed from watchlist`);return;}
    if(t.dataset.country){state.country=t.dataset.country;render();return;}
    if(t.dataset.side){detail.side=t.dataset.side;renderDetail();return;}
    if(t.dataset.tf){detail.tf=t.dataset.tf;renderDetail();return;}
    if(t.dataset.type!=null){detail.type=+t.dataset.type;renderDetail();return;}
    if(t.dataset.authmode!=null){authReg=t.dataset.authmode==='1';renderAuth();return;}
    if(t.hasAttribute('data-authtoggle')){authReg=!authReg;renderAuth();return;}
    if(t.dataset.close){hideOverlay(t.dataset.close);return;}
    if(t.dataset.open){hideOverlay('search');openDetail(t.dataset.open);return;}
    if(t.dataset.url){window.open(t.dataset.url,'_blank','noopener');return;}
    if(t.dataset.toast){toast(t.dataset.toast);return;}
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='searchInput'){searchQ=e.target.value;renderSearch();}
    else if(e.target.id==='detShares'){
      detail.shares=Math.max(0,parseInt(e.target.value,10)||0);
      const co=BYSYM[detail.sym];const est=document.getElementById('detEstimate');
      if(est)est.textContent=fmtPrice(priceOf(co)*detail.shares,state.cur);
    }
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){['detail','auth','search'].forEach(hideOverlay);}});
}

/* ================= boot ================= */
function buildShell(){
  document.getElementById('app').innerHTML=`
  <div class="shell">
    <aside class="sidebar">
      <a class="logo" data-tab="markets"><span class="logomark"><span style="height:7px;opacity:.55"></span><span style="height:12px;opacity:.78"></span><span style="height:16px"></span></span>Vibe<span class="b">Stocking</span></a>
      <nav class="side-nav" id="sideNav"></nav>
      <div class="side-foot"><div class="side-status" id="sideStatus"></div>
        <div class="side-hint">Web build · static front end<br/>live data via Yahoo Finance &amp; NewsAPI</div></div>
    </aside>
    <div class="main">
      <header class="appbar" id="appbar"></header>
      <div class="content" id="content"></div>
      <nav class="tabbar" id="tabbar"></nav>
    </div>
  </div>
  <div class="overlay" id="ov-detail"><div class="ov-card" id="detailBody"></div></div>
  <div class="overlay" id="ov-auth"><div class="ov-card" id="authBody"></div></div>
  <div class="overlay" id="ov-search"><div class="ov-card" id="searchBody"></div></div>
  <div class="toast" id="toast"></div>`;
}
(function init(){
  document.documentElement.dataset.theme=state.theme;
  buildShell(); bindEvents(); loadCache(); render(); refresh();
})();
