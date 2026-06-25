/* ============================================================
   VibeStocking Web — data engine + chart math (pure, no DOM).
   Ported from lib/data/market_data.dart. Provides the universe,
   deterministic demo series (fallback), SVG chart renderers and
   formatting helpers shared by api.js / app.js.
   ============================================================ */

/* ---- Universe ---- */
const COMPANIES = [
 ['NVDA','NVIDIA Corp.','NASDAQ','US','Semiconductors',1187.4,0.012,3.42,11,2920,64.1,0.03],
 ['AAPL','Apple Inc.','NASDAQ','US','Consumer Tech',229.86,0.008,1.18,12,3480,34.2,0.51],
 ['MSFT','Microsoft Corp.','NASDAQ','US','Software',467.21,0.007,0.74,13,3470,37.8,0.71],
 ['TSLA','Tesla Inc.','NASDAQ','US','Automotive',248.5,0.018,-2.86,14,792,71.4,0.0],
 ['AMZN','Amazon.com Inc.','NASDAQ','US','E-Commerce',201.3,0.009,1.92,15,2090,44.6,0.0],
 ['GOOGL','Alphabet Inc.','NASDAQ','US','Internet',178.4,0.008,0.42,16,2180,26.1,0.45],
 ['META','Meta Platforms','NASDAQ','US','Social',588.7,0.011,2.34,17,1490,28.9,0.38],
 ['AMD','Adv. Micro Devices','NASDAQ','US','Semiconductors',168.9,0.016,-1.44,18,273,49.7,0.0],
 ['JPM','JPMorgan Chase','NYSE','US','Banking',212.6,0.006,0.58,19,612,12.4,2.3],
 ['NFLX','Netflix Inc.','NASDAQ','US','Streaming',712.3,0.012,-0.92,20,305,41.2,0.0],
 ['DIS','Walt Disney Co.','NYSE','US','Media',103.7,0.009,1.06,21,188,38.5,0.9],
 ['COIN','Coinbase Global','NASDAQ','US','Crypto',241.8,0.024,5.17,22,60,33.1,0.0],
 ['SAP','SAP SE','XETRA','DE','Software',198.4,0.007,0.83,23,244,45.0,1.1],
 ['SIE','Siemens AG','XETRA','DE','Industrials',176.2,0.008,-0.61,24,141,19.8,2.6],
 ['ASML','ASML Holding','AEX','NL','Semiconductors',712.9,0.013,2.71,25,286,39.4,0.9],
 ['SHEL','Shell plc','LSE','GB','Energy',28.4,0.007,-0.34,26,198,12.9,3.9],
 ['TM','Toyota Motor','TSE','JP','Automotive',184.6,0.006,0.47,27,252,8.2,2.4],
 ['BABA','Alibaba Group','NYSE','CN','E-Commerce',78.9,0.015,-2.08,28,191,16.7,0.0],
].map(a=>{const o={sym:a[0],name:a[1],exch:a[2],country:a[3],sector:a[4],price:a[5],vol:a[6],dPct:a[7],seed:a[8],mcap:a[9],pe:a[10],divYield:a[11]};
  o.prevClose=o.price/(1+o.dPct/100); o.dAbs=o.price-o.prevClose; return o;});
const BYSYM = Object.fromEntries(COMPANIES.map(c=>[c.sym,c]));

const INDICES = [
 ['SPX','S&P 500','US',5431.6,0.004,0.62,101],['NDX','Nasdaq 100','US',19210.4,0.006,1.04,102],
 ['DJI','Dow Jones','US',38790.2,0.004,-0.21,103],['DAX','DAX 40','DE',18412.7,0.005,0.38,104],
 ['UKX','FTSE 100','GB',8192.4,0.004,-0.14,105],['NKY','Nikkei 225','JP',38703.5,0.006,0.81,106],
].map(a=>{const o={sym:a[0],name:a[1],country:a[2],base:a[3],vol:a[4],dPct:a[5],seed:a[6]};
  o.prevClose=o.base/(1+o.dPct/100); o.dAbs=o.base-o.prevClose; return o;});
const BYIDX = Object.fromEntries(INDICES.map(i=>[i.sym,i]));

const CUR = {USD:['$',1,'US Dollar'],EUR:['€',0.92,'Euro'],GBP:['£',0.79,'British Pound'],
  JPY:['¥',157.3,'Japanese Yen'],CHF:['Fr',0.89,'Swiss Franc'],AED:['د.إ',3.67,'UAE Dirham']};

const COUNTRIES = [
 ['US','United States','🇺🇸','NYSE · NASDAQ','SPX'],['DE','Germany','🇩🇪','XETRA','DAX'],
 ['GB','United Kingdom','🇬🇧','LSE','UKX'],['JP','Japan','🇯🇵','TSE','NKY'],
 ['NL','Netherlands','🇳🇱','Euronext','DAX'],['CN','China','🇨🇳','SSE · HKEX','NKY'],
].map(a=>({code:a[0],name:a[1],flag:a[2],market:a[3],index:a[4]}));

/* static news (fallback only — live headlines come from NewsAPI) */
const NEWS = [
 [1,'NVDA','Earnings','Nvidia smashes Q3 estimates as data-center revenue jumps 94% on AI demand','MarketWire',12,'up','chip render'],
 [2,'TSLA','Autos','Tesla deliveries slip in Europe amid intensifying EV price war','Reuters',38,'down','EV photo'],
 [3,'AAPL','Products','Apple unveils on-device AI suite, shares tick higher into close','Bloomberg',51,'up','device shot'],
 [4,'COIN','Crypto','Coinbase rallies as Bitcoin reclaims $72K, trading volumes surge','CoinDesk',64,'up','crypto art'],
 [5,'META','Tech','Meta opens Reality Labs spend, betting on next-gen AR glasses','The Verge',88,'up','AR headset'],
 [6,'SHEL','Energy','Shell trims outlook as oil softens; buyback program maintained','FT',121,'down','refinery'],
 [7,'AMZN','Retail','Amazon Web Services lands multi-year government cloud contract','CNBC',144,'up','data center'],
 [8,'BABA','Markets','Alibaba slides as China consumer sentiment data disappoints','WSJ',180,'down','storefront'],
 [9,'ASML','Semis','ASML order book swells on next-gen EUV lithography demand','Reuters',205,'up','chip render'],
 [10,'JPM','Banking','JPMorgan flags resilient consumer, lifts net-interest guidance','Bloomberg',240,'up','HQ tower'],
].map(a=>({id:a[0],sym:a[1],tag:a[2],title:a[3],src:a[4],mins:a[5],sentiment:a[6],img:a[7]}));

const PORTFOLIO = [['NVDA',14,612.40],['AAPL',60,188.20],['MSFT',22,402.10],
  ['TSLA',30,274.80],['AMZN',25,165.30],['COIN',18,198.55]].map(a=>({sym:a[0],shares:a[1],avg:a[2]}));
const WATCHLIST = ['META','AMD','ASML','GOOGL','NFLX'];

const HUES = {NVDA:140,AAPL:220,MSFT:205,TSLA:0,AMZN:32,GOOGL:220,META:222,AMD:6,JPM:210,
  NFLX:354,DIS:232,COIN:222,SAP:205,SIE:178,ASML:24,SHEL:48,TM:0,BABA:28,
  SPX:220,NDX:222,DJI:210,DAX:200,UKX:250,NKY:354};
const hueFor=s=>HUES[s]??220;
const chipGrad=s=>{const h=hueFor(s);return `linear-gradient(135deg, hsl(${h} 72% 56%), hsl(${(h+34)%360} 78% 44%))`;};

/* ---- Demo chart math (fallback when an API call fails) ---- */
function rng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
function walk(seed,base,points,vol,trend){const r=rng(seed);const out=[];let v=base*(1-trend*0.5);const drift=(base*trend)/points;let mom=0;for(let i=0;i<points;i++){mom=mom*0.82+(r()-0.5)*base*vol;v+=drift+mom;if(v<base*0.25)v=base*0.25;out.push(v);}return out;}
function anchor(s,a,b){const n=s.length,s0=s[0],sN=s[n-1];for(let i=0;i<n;i++){const t=i/(n-1);const own=s0+(sN-s0)*t;const dev=s[i]-own;s[i]=(a+(b-a)*t)+dev;}}
const TF={'1D':[78,0.45],'1W':[56,0.7],'1M':[30,1.0],'3M':[64,1.5],'1Y':[80,2.4]};
const TFO=['1D','1W','1M','3M','1Y'];
const _cache={};
function seriesFor(sym,tf){const k=sym+'|'+tf;if(_cache[k])return _cache[k];const c=BYSYM[sym];const[pts,volK]=TF[tf];let trend;
  if(tf==='1D')trend=c.dPct/100;
  else if(tf==='1W')trend=(c.dPct/100)*1.6+(rng(c.seed+7)()-0.45)*0.05;
  else if(tf==='1M')trend=(rng(c.seed+13)()-0.4)*0.22;
  else if(tf==='3M')trend=(rng(c.seed+17)()-0.38)*0.4;
  else trend=(rng(c.seed+23)()-0.32)*0.85;
  const s=walk(c.seed*31+pts,c.price,pts,c.vol*volK,trend);
  if(tf==='1D')anchor(s,c.prevClose,c.price);_cache[k]=s;return s;}
function indexSeries(ix,tf){const[pts,volK]=TF[tf];const trend=tf==='1D'?ix.dPct/100:(rng(ix.seed+tf.length*9)()-0.4)*(tf==='1Y'?0.4:0.2);
  const s=walk(ix.seed*17+pts,ix.base,pts,ix.vol*volK,trend);if(tf==='1D')anchor(s,ix.prevClose,ix.base);return s;}

/* ---- SVG renderers ---- */
function areaSVG(s,w,h,colorOverride){
  if(!s||s.length<2)return '';
  const up=s[s.length-1]>=s[0];const color=colorOverride||(up?'var(--up)':'var(--down)');
  const pad=8/220*h, innerH=h-pad*2;
  const mn=Math.min(...s),mx=Math.max(...s),range=(mx-mn)||1;
  const pts=s.map((v,i)=>[i/(s.length-1)*w, pad+innerH-((v-mn)/range)*innerH]);
  let line='M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
  for(let i=1;i<pts.length;i++){const p0=pts[i-1],p1=pts[i],cx=((p0[0]+p1[0])/2).toFixed(1);
    line+=`C${cx} ${p0[1].toFixed(1)} ${cx} ${p1[1].toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;}
  const area=line+`L${w} ${h}L0 ${h}Z`;
  const last=pts[pts.length-1];
  const gid='g'+Math.random().toString(36).slice(2,7);
  let grid='';for(let i=0;i<=4;i++){const y=(h/4*i).toFixed(1);grid+=`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="var(--chart-grid)" stroke-width="1"/>`;}
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>${grid}
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="6" fill="${color}" opacity="0.18"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.2" fill="${color}"/></svg>`;
}
function sparkSVG(s){if(!s||s.length<2)return '';const w=52,h=26,up=s[s.length-1]>=s[0],color=up?'var(--up)':'var(--down)';
  const pad=3/36*h,innerH=h-pad*2,mn=Math.min(...s),mx=Math.max(...s),range=(mx-mn)||1;
  const pts=s.map((v,i)=>`${(i/(s.length-1)*w).toFixed(1)},${(pad+innerH-((v-mn)/range)*innerH).toFixed(1)}`);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%">
    <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}
/* candles from real OHLC bars [{open,high,low,close}], downsampled to <=maxBars */
function candleBarsSVG(bars,maxBars,w,h){
  if(!bars||!bars.length)return '';
  let data=bars;
  if(bars.length>maxBars){const step=Math.ceil(bars.length/maxBars);data=[];
    for(let i=0;i<bars.length;i+=step){const sl=bars.slice(i,Math.min(i+step,bars.length));
      let hi=sl[0].high,lo=sl[0].low;sl.forEach(c=>{hi=Math.max(hi,c.high);lo=Math.min(lo,c.low);});
      data.push({open:sl[0].open,high:hi,low:lo,close:sl[sl.length-1].close});}}
  let mn=Infinity,mx=-Infinity;data.forEach(d=>{mn=Math.min(mn,d.low);mx=Math.max(mx,d.high);});
  const range=(mx-mn)||1,pad=6/220*h;const y=v=>pad+(h-pad*2)-((v-mn)/range)*(h-pad*2);
  const cw=w/data.length,bw=Math.max(1,cw*0.62);let grid='';
  for(let i=0;i<=4;i++){const yy=(h/4*i).toFixed(1);grid+=`<line x1="0" y1="${yy}" x2="${w}" y2="${yy}" stroke="var(--chart-grid)" stroke-width="1"/>`;}
  let body='';data.forEach((d,i)=>{const x=i*cw+cw/2;const up=d.close>=d.open;const col=up?'var(--up)':'var(--down)';
    const yo=y(d.open),yc=y(d.close),top=Math.min(yo,yc),bh=Math.max(Math.abs(yc-yo),1.5);
    body+=`<line x1="${x.toFixed(1)}" y1="${y(d.high).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y(d.low).toFixed(1)}" stroke="${col}" stroke-width="1.2"/>
      <rect x="${(x-bw/2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="1" fill="${col}"/>`;});
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%">${grid}${body}</svg>`;
}

/* ---- Formatting ---- */
function grp(v,dp){return v.toLocaleString('en-US',{minimumFractionDigits:dp,maximumFractionDigits:dp});}
function fmtPrice(usd,code,dp){const[sym,rate]=CUR[code];const v=usd*rate;const d=dp!=null?dp:(code==='JPY'?0:2);return sym+grp(v,d);}
function fmtNum(v,dp){return grp(v,dp||0);}
function fmtPct(p){return (p>=0?'+':'')+p.toFixed(2)+'%';}
function fmtMcap(b,code){const[sym,rate]=CUR[code];const v=b*rate;return v>=1000?sym+(v/1000).toFixed(2)+'T':sym+v.toFixed(1)+'B';}
function fmtVol(v){if(v>=1e9)return (v/1e9).toFixed(2)+'B';if(v>=1e6)return (v/1e6).toFixed(2)+'M';if(v>=1e3)return (v/1e3).toFixed(2)+'K';return ''+Math.round(v);}
function relTime(m){if(m<60)return m+'m ago';const h=Math.floor(m/60);return h<24?h+'h ago':Math.floor(h/24)+'d ago';}
function escapeHtml(s){return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

const ICONS={
  chart:'<path d="M3 3v18h18"/><path d="M7 14l3-4 3 2 4-6"/>',
  article:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  wallet:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M17 14h.01"/>',
  crown:'<path d="M3 7l4 4 5-7 5 7 4-4-2 12H5z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
  moon:'<path d="M21 12.5A9 9 0 1 1 11.5 3a7 7 0 0 0 9.5 9.5z"/>',
  back:'<path d="M15 18l-6-6 6-6"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  open:'<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 13v6H5V5h6"/>'};
