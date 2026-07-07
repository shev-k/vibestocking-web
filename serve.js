// ============================================================
// serve.js — КРОШЕЧНЫЙ СЕРВЕР: статика + CORS-прокси.
// Запуск:  node serve.js   ->  открыть http://localhost:8000/
//
// ЗАЧЕМ НУЖЕН ПРОКСИ: браузер блокирует прямые запросы к Yahoo/NewsAPI
// политикой CORS (эти API не отдают заголовок Access-Control-Allow-Origin).
// Публичные CORS-прокси ненадёжны, поэтому этот сервер сам работает прокси:
//   GET /proxy?url=<закодированный адрес>
// — сервер скачивает данные САМ (на сервере CORS не действует) и отдаёт
// их браузеру уже с разрешающим заголовком "*". api.js ходит на /proxy.
//
// Написан на голом Node.js (http, fs, path) — ноль npm-зависимостей.
// Рядом лежит render.yaml — конфиг деплоя этого сервера на Render.com.
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;                 // раздаём файлы из папки скрипта
const PORT = process.env.PORT || 8000;  // порт из окружения (для хостинга) или 8000
// Браузерный User-Agent — без него Yahoo отклоняет запросы.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
// MIME-типы для правильной отдачи статики.
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};

/// Обработчик /proxy: скачать target и вернуть браузеру с CORS-заголовком.
async function handleProxy(target, res){
  if (!target){ res.writeHead(400); res.end('missing url'); return; }
  // AbortController + таймер: зависший внешний запрос обрубается
  // через 15 секунд — клиент получит 502, а не вечное ожидание.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(target, {signal: ctrl.signal, headers: {'User-Agent': UA, 'Accept':'application/json,text/plain,*/*'}});
    const body = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, {
      // Пробрасываем content-type источника.
      'content-type': r.headers.get('content-type') || 'application/json',
      // ГЛАВНАЯ строка: разрешаем доступ любому origin — ради неё всё и затевалось.
      'access-control-allow-origin': '*',
      'cache-control': 'no-store', // биржевые данные не кэшируем
    });
    res.end(body);
  } catch (e) {
    // Ошибка/таймаут -> 502 с текстом (тоже с CORS-заголовком).
    res.writeHead(502, {'access-control-allow-origin':'*','content-type':'text/plain'});
    res.end('proxy error: ' + e.message);
  } finally { clearTimeout(t); }
}

http.createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  // Маршрут 1: /proxy?url=... -> проксирование.
  if (u.pathname === '/proxy'){ handleProxy(u.searchParams.get('url'), res); return; }

  // Маршрут 2: всё остальное — раздача статических файлов.
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html'; // корень -> главная страница
  // Защита от path-traversal: срезаем "../", чтобы нельзя было
  // запросить файл ЗА ПРЕДЕЛАМИ папки проекта.
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(file, (err, data) => {
    if (err){ res.writeHead(404, {'content-type':'text/plain'}); res.end('404'); return; }
    res.writeHead(200, {'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'});
    res.end(data);
  });
}).listen(PORT, () => console.log(`VibeStocking web → http://localhost:${PORT}/  (proxy at /proxy)`));
