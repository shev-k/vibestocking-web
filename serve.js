// Tiny static file server + CORS proxy for the VibeStocking web build.
// Run:  node serve.js   ->  open http://localhost:8000/
//
// Public CORS proxies are unreliable, so this server doubles as one:
//   GET /proxy?url=<encoded upstream url>
// fetches the target server-side (no CORS there) and returns it to the
// browser with Access-Control-Allow-Origin:*. api.js points at /proxy.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};

async function handleProxy(target, res){
  if (!target){ res.writeHead(400); res.end('missing url'); return; }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(target, {signal: ctrl.signal, headers: {'User-Agent': UA, 'Accept':'application/json,text/plain,*/*'}});
    const body = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, {
      'content-type': r.headers.get('content-type') || 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(502, {'access-control-allow-origin':'*','content-type':'text/plain'});
    res.end('proxy error: ' + e.message);
  } finally { clearTimeout(t); }
}

http.createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (u.pathname === '/proxy'){ handleProxy(u.searchParams.get('url'), res); return; }

  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(file, (err, data) => {
    if (err){ res.writeHead(404, {'content-type':'text/plain'}); res.end('404'); return; }
    res.writeHead(200, {'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'});
    res.end(data);
  });
}).listen(PORT, () => console.log(`VibeStocking web → http://localhost:${PORT}/  (proxy at /proxy)`));
