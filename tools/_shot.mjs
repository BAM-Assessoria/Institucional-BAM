// Screenshots de página inteira via Chrome DevTools Protocol (sem libs).
// Uso: chrome --headless --remote-debugging-port=9222 já rodando.
import { writeFileSync, mkdirSync } from 'node:fs';

const PORT = 9222;
const BASE = 'file:///C:/Users/bamas/Desktop/Institucional-BAM';
const pages = [
  ['home', `${BASE}/index.html`],
  ['sobre', `${BASE}/sobre.html`],
  ['blog', `${BASE}/blog/index.html`],
  ['post', `${BASE}/blog/qual-a-funcao-do-marketing.html`],
];
mkdirSync('data/shots', { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getWs() {
  for (let i = 0; i < 30; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const pg = list.find(t => t.type === 'page');
      if (pg && pg.webSocketDebuggerUrl) return pg.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error('Chrome remote-debugging não respondeu');
}
function makeClient(ws) {
  let id = 0; const pending = new Map(); const waiters = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    else if (m.method) waiters.forEach(w => w(m));
  });
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const once = (method) => new Promise(res => { const w = (m) => { if (m.method === method) { const k = waiters.indexOf(w); if (k >= 0) waiters.splice(k, 1); res(m.params); } }; waiters.push(w); });
  return { send, once };
}
const ws = new WebSocket(await getWs());
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const cdp = makeClient(ws);
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const only = process.argv[2];
for (const [name, url] of pages) {
  if (only && name !== only) continue;
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await Promise.race([loaded, sleep(8000)]);
  await sleep(800);
  await cdp.send('Runtime.evaluate', { awaitPromise: true, expression: `(async()=>{const h=document.body.scrollHeight;for(let y=0;y<h;y+=700){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,50));}window.scrollTo(0,0);document.querySelectorAll('.r').forEach(e=>e.classList.add('in'));const l=document.getElementById('loader');if(l)l.classList.add('done');document.body.classList.add('no-hscroll');await new Promise(r=>setTimeout(r,500));})()` });
  await sleep(1000);
  const { cssContentSize, contentSize } = await cdp.send('Page.getLayoutMetrics');
  const cs = cssContentSize || contentSize;
  const height = Math.min(Math.ceil(cs.height), 24000);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: Math.ceil(cs.width), height, scale: 1 } });
  writeFileSync(`data/shots/${name}.png`, Buffer.from(shot.data, 'base64'));
  console.log(`${name}: ${Math.ceil(cs.width)}x${height}`);
}
ws.close();
console.log('done');
