// Captura screenshots de página inteira via Chrome DevTools Protocol (sem libs).
// Pré-requisito: Chrome rodando com --remote-debugging-port=9222
import { writeFileSync } from 'node:fs';

const PORT = 9222;
const BASE = 'file:///C:/Users/luana/OneDrive/Desktop/site%20bam';
const pages = [
  ['home', `${BASE}/index.html`],
  ['sobre', `${BASE}/sobre.html`],
  ['blog', `${BASE}/blog/index.html`],
  ['post', `${BASE}/blog/qual-a-funcao-do-marketing.html`],
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getPageWs() {
  for (let i = 0; i < 20; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const pg = list.find(t => t.type === 'page');
      if (pg && pg.webSocketDebuggerUrl) return pg.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
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

const wsUrl = await getPageWs();
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const cdp = makeClient(ws);
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

for (const [name, url] of pages) {
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await Promise.race([loaded, sleep(8000)]);
  await sleep(800);
  // rola a página inteira para disparar o lazy-load das imagens, depois volta ao topo
  await cdp.send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `(async()=>{const h=document.body.scrollHeight;for(let y=0;y<h;y+=700){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}window.scrollTo(0,0);await new Promise(r=>setTimeout(r,400));})()`,
  });
  await sleep(1200); // fontes + imagens carregadas
  const { cssContentSize, contentSize } = await cdp.send('Page.getLayoutMetrics');
  const cs = cssContentSize || contentSize;
  const height = Math.min(Math.ceil(cs.height), 24000);
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(cs.width), height, scale: 1 },
  });
  writeFileSync(`data/shots/${name}.png`, Buffer.from(shot.data, 'base64'));
  console.log(`${name}: ${Math.ceil(cs.width)}x${height}`);
}
ws.close();
console.log('done');
