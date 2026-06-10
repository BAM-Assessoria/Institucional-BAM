/* =============================================================
   BAM Assessoria — "A Estrada": scrubber de frames no scroll.
   Desenha, num <canvas> fixo de fundo, o frame correspondente ao
   progresso de scroll da página. Sequência pré-renderizada (Fase 1:
   frames placeholder). Não roda em mobile nem com redução de
   movimento — nesses casos fica só o poster estático.
   Vanilla, sem dependências. CSP: tudo same-origin ('self').
   ============================================================= */
(function () {
  'use strict';

  var canvas = document.getElementById('roadCanvas');
  if (!canvas) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function isMobile() {
    return window.innerWidth < 1025 || window.matchMedia('(pointer: coarse)').matches;
  }
  // Elegibilidade: só desktop, sem redução de movimento. Senão, poster estático.
  if (reduceMotion || isMobile()) return;

  var TOTAL = parseInt(canvas.getAttribute('data-frames'), 10) || 0;
  var SRC = canvas.getAttribute('data-src') || 'assets/road/';
  if (TOTAL < 2) return;

  document.body.classList.add('journey-on');

  var ctx = canvas.getContext('2d', { alpha: true });
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var cssW = 0, cssH = 0;

  function resize() {
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (lastDrawn >= 0) paint(lastDrawn, true);
  }

  /* ---------- store de frames + carregamento ---------- */
  var frames = new Array(TOTAL);   // Image | undefined
  var state = new Array(TOTAL);    // 0 vazio | 1 carregando | 2 pronto
  var inflight = 0;
  var MAX_PARALLEL = 5;
  var WINDOW_AHEAD = 28, WINDOW_BEHIND = 10, KEEP = 70;
  var queue = [];

  function url(n) { return SRC + 'frame-' + String(n + 1).padStart(4, '0') + '.webp'; }

  function request(n) {
    if (n < 0 || n >= TOTAL || state[n]) return;
    state[n] = 1; queue.push(n); pump();
  }
  function pump() {
    while (inflight < MAX_PARALLEL && queue.length) {
      var n = queue.shift();
      inflight++;
      var img = new Image();
      img.decoding = 'async';
      img.onload = (function (idx, im) {
        return function () {
          frames[idx] = im; state[idx] = 2; inflight--;
          if (!firstReady) { firstReady = true; paint(idx, true); }
          else if (idx === wantIndex) paint(idx, true);
          pump();
        };
      })(n, img);
      img.onerror = (function (idx) {
        return function () { state[idx] = 0; inflight--; pump(); };
      })(n);
      img.src = url(n);
    }
  }
  function ensureWindow(center) {
    // carrega à frente primeiro (sentido do scroll), depois atrás
    for (var a = 0; a <= WINDOW_AHEAD; a++) request(center + a);
    for (var b = 1; b <= WINDOW_BEHIND; b++) request(center - b);
    // libera frames distantes para o GC
    for (var i = 0; i < TOTAL; i++) {
      if (state[i] === 2 && (i < center - KEEP || i > center + KEEP)) {
        frames[i] = undefined; state[i] = 0;
      }
    }
  }

  function nearestReady(n) {
    if (state[n] === 2) return n;
    for (var d = 1; d < TOTAL; d++) {
      if (n - d >= 0 && state[n - d] === 2) return n - d;
      if (n + d < TOTAL && state[n + d] === 2) return n + d;
    }
    return -1;
  }

  /* ---------- desenho (cover-fit) ---------- */
  var lastDrawn = -1, firstReady = false;
  function paint(n, force) {
    var src = nearestReady(n);
    if (src < 0) return;
    var img = frames[src];
    if (!img) return;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var scale = Math.max(cssW / iw, cssH / ih);
    var dw = iw * scale, dh = ih * scale;
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.drawImage(img, (cssW - dw) / 2, (cssH - dh) / 2, dw, dh);
    if (!force) lastDrawn = n;
  }

  /* ---------- progresso de scroll → frame (com easing) ---------- */
  var target = 0, current = 0, wantIndex = 0, running = false;
  var track = document.getElementById('roadTrack');

  function scrollProgress() {
    if (track) {
      var r = track.getBoundingClientRect();
      var total = track.offsetHeight - window.innerHeight;
      return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    }
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }
  function tick() {
    current += (target - current) * 0.14;
    if (Math.abs(target - current) < 0.0004) current = target;
    var idx = Math.round(current * (TOTAL - 1));
    if (idx !== wantIndex) { wantIndex = idx; ensureWindow(idx); }
    if (idx !== lastDrawn) { paint(idx); lastDrawn = idx; }
    if (current !== target) { requestAnimationFrame(tick); }
    else { running = false; }
  }
  function kick() {
    target = scrollProgress();
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  /* ---------- boot ---------- */
  resize();
  ensureWindow(0);
  target = current = scrollProgress();
  wantIndex = Math.round(current * (TOTAL - 1));
  ensureWindow(wantIndex);

  window.addEventListener('scroll', kick, { passive: true });
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { dpr = Math.min(window.devicePixelRatio || 1, 2); resize(); kick(); }, 160);
  });
  kick();
})();
