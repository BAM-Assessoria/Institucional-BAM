/* =============================================================
   BAM — Gera os frames PLACEHOLDER da estrada (Fase 1).
   Dirige o Chrome (--remote-debugging-port=9222) carregando
   tools/road-gen.html e salva assets/road/frame-NNNN.webp + poster.
   Uso:  node tools/gen-road-frames.mjs [total]
   ============================================================= */
import { writeFileSync, mkdirSync } from 'node:fs';

const PORT = 9222;
const TOTAL = parseInt(process.argv[2], 10) || 140;
const QUALITY = 0.72;
const BASE = 'file:///C:/Users/bamas/Desktop/Institucional-BAM/tools/road-gen.html';
const OUT = 'assets/road';
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getWs() {
  for (let i = 0; i < 30; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const p = l.find((t) => t.type === 'page');
      if (p && p.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error('Chrome remote-debugging não respondeu (rode o Chrome headless com --remote-debugging-port=9222).');
}
function mk(ws) {
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  return (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
}

const ws = new WebSocket(await getWs());
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = mk(ws);
await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: BASE });
await sleep(2500); // carrega a fonte Oswald

async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result && r.result.result ? r.result.result.value : undefined;
}

let total = 0;
for (let i = 0; i < TOTAL; i++) {
  await send('Runtime.evaluate', { expression: `window.__draw(${i}, ${TOTAL})` });
  const dataUrl = await evalJs(`window.__toWebp(${QUALITY})`);
  const b64 = dataUrl.split(',')[1];
  const buf = Buffer.from(b64, 'base64');
  const name = `${OUT}/frame-${String(i + 1).padStart(4, '0')}.webp`;
  writeFileSync(name, buf);
  if (i === 0) writeFileSync(`${OUT}/poster.webp`, buf); // poster = 1º frame
  total += buf.length;
  if (i % 20 === 0) console.log(`frame ${i + 1}/${TOTAL} (${(buf.length / 1024).toFixed(1)} KB)`);
}
ws.close();
console.log(`\nOK: ${TOTAL} frames + poster. Peso total: ${(total / 1024 / 1024).toFixed(2)} MB · média ${(total / TOTAL / 1024).toFixed(1)} KB/frame.`);
