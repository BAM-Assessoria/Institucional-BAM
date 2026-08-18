/* Captura cada folha do preview do ebook em PNG, para conferência visual.
   Uso: node tools/_ebook-shot.mjs [dirDeSaida]  (padrão: tools/.ebook-shots) */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = process.argv[2] || 'tools/.ebook-shots';
const PORT = 9334;
const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROMES.find((p) => existsSync(p)), [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu',
  '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + resolve('tools/.chrome-shot'), 'about:blank',
], { stdio: 'ignore' });

async function getWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const pg = list.find((t) => t.type === 'page');
      if (pg?.webSocketDebuggerUrl) return pg.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error('Chrome não respondeu');
}
function makeClient(ws) {
  let id = 0; const pending = new Map(); const waiters = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) waiters.forEach((w) => w(m));
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const once = (method) => new Promise((res) => {
    const w = (m) => { if (m.method === method) { waiters.splice(waiters.indexOf(w), 1); res(m.params); } };
    waiters.push(w);
  });
  return { send, once };
}

try {
  const ws = new WebSocket(await getWs());
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const cdp = makeClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 794, height: 1123, deviceScaleFactor: 1.4, mobile: false });

  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: pathToFileURL(resolve('tools/.ebook-preview.html')).href });
  await Promise.race([loaded, sleep(15000)]);
  for (let i = 0; i < 60; i++) {
    const r = await cdp.send('Runtime.evaluate', { expression: 'window.__done === true' });
    if (r.result?.value === true) break;
    await sleep(300);
  }
  await sleep(600);

  const n = (await cdp.send('Runtime.evaluate', { expression: 'document.querySelectorAll(".page").length' })).result.value;
  for (let i = 0; i < n; i++) {
    const box = (await cdp.send('Runtime.evaluate', {
      expression: `(()=>{const p=document.querySelectorAll('.page')[${i}];const r=p.getBoundingClientRect();
        return JSON.stringify({x:r.x+window.scrollX,y:r.y+window.scrollY,w:r.width,h:r.height})})()`,
    })).result.value;
    const b = JSON.parse(box);
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: b.x, y: b.y, width: Math.round(b.w), height: Math.round(b.h), scale: 1.4 },
    });
    writeFileSync(`${OUT}/p${String(i + 1).padStart(2, '0')}.png`, Buffer.from(shot.data, 'base64'));
  }
  console.log(`ok: ${n} folhas em ${OUT}`);
  ws.close();
} finally { chrome.kill(); }
