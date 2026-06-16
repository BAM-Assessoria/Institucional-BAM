/* =============================================================
   BAM Assessoria — "A Estrada": cena 3D real-time no <canvas>.
   A pista se constrói em BLOCOS 3D conforme o scroll: cada bloco
   nasce abaixo e sobe/encaixa à frente da câmera, que avança junto.
   Pseudo-3D em Canvas 2D (projeção em perspectiva) — sem libs, sem
   vídeo, tudo same-origin (CSP 'self'). Não roda em mobile nem com
   redução de movimento (fica o poster estático).
   Sobre essa estrada limpa roda o efeito "placa → slogan" do hero.
   ============================================================= */
(function () {
  'use strict';

  var canvas = document.getElementById('roadCanvas');
  if (!canvas) return;

  // Quando a estrada não anima (mobile / movimento reduzido), o slogan
  // aparece inteiro e a placa fica oculta.
  function revealHeroFallback() {
    var ws = document.querySelectorAll('.hero h1 .hw');
    for (var i = 0; i < ws.length; i++) ws[i].classList.add('show');
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function isMobile() {
    return window.innerWidth < 1025 || window.matchMedia('(pointer: coarse)').matches;
  }
  if (reduceMotion || isMobile()) { revealHeroFallback(); return; }

  document.body.classList.add('journey-on');
  // no desktop a cena 3D substitui o poster estático
  var poster = document.querySelector('.road-poster');
  if (poster) poster.style.display = 'none';

  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;

  /* ---------- parâmetros da estrada (AJUSTÁVEIS) ---------- */
  var ROAD = {
    halfW: 2.2,       // metade da largura da pista
    camH: 1.4,        // altura da câmera acima da pista
    cols: 6,          // colunas da grade (textura tech da pista)
    seg: 1.4,         // profundidade de cada bloco
    gap: 0.08,        // folga em profundidade (pequena → pista contínua, não blocos soltos)
    cellGap: 0.06,    // folga lateral (pequena → vira estrada, não blocos)
    edgeW: 0.18,      // espessura das bordas neon (definem a estrada)
    thick: 0.45,      // espessura 3D do bloco
    draw: 38,         // distância de desenho
    riseBand: 7,      // faixa na qual o bloco encaixa
    drop: 2.2,        // quanto o bloco nasce abaixo (menor → mais pista, menos "voando")
    wave: 1.4,        // defasagem da montagem (onda matriz)
    length: 92,       // comprimento TOTAL
    base: 6,          // trecho já montado no início
    branchLen: 30,    // últimos N: a estrada se BIFURCA em vários caminhos (o destino)
    branchHalfW: 1.0, // largura de cada caminho da bifurcação (largo = lê como estrada)
    branchCols: 4,    // colunas por caminho
    spread: 0.085,    // o quanto os caminhos se abrem (leque)
    arriveGap: 44,    // a câmera para antes do fim → você "chega" e vê a bifurcação à frente
    focal: 0,
    horizon: 0
  };
  var GREEN = '#00FFAE';

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ROAD.focal = H * 0.88;
    ROAD.horizon = H * 0.45;
  }

  var camZ = 0, buildFront = 0, current = 0, target = 0, running = false;
  var track = document.getElementById('roadTrack');

  // posiciona câmera e frente de construção a partir do progresso (eased).
  // A estrada tem FIM: a construção vai de `base` até `length` e a câmera para
  // `arriveGap` antes do fim — dá a sensação de chegar a um destino.
  function setCam() {
    camZ = current * (ROAD.length - ROAD.arriveGap);
    buildFront = ROAD.base + current * (ROAD.length - ROAD.base);
  }

  function scrollProgress() {
    if (track) {
      var r = track.getBoundingClientRect();
      var total = track.offsetHeight - window.innerHeight;
      return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    }
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }

  function project(x, y, z) {
    var dz = z - camZ; if (dz < 0.05) dz = 0.05;
    var s = ROAD.focal / dz;
    return { x: W / 2 + x * s, y: ROAD.horizon + (ROAD.camH - y) * s, s: s };
  }

  function quad(a, b, c, d) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
  }

  function background() {
    ctx.fillStyle = '#040605';
    ctx.fillRect(0, 0, W, H);
    var rg = ctx.createRadialGradient(W / 2, ROAD.horizon, 0, W / 2, ROAD.horizon, H * 0.72);
    rg.addColorStop(0, 'rgba(0,140,92,.30)');
    rg.addColorStop(0.5, 'rgba(0,60,42,.14)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- faixas: estrada principal + a bifurcação em vários caminhos no fim ----
  var BRANCH_START = ROAD.length - ROAD.branchLen;
  var MAIN = { x0: 0, dir: 0, spread: 0, zStart: 0, zEnd: BRANCH_START + ROAD.seg, halfW: ROAD.halfW, cols: ROAD.cols, dropMul: 1 };
  var BRANCHES = [
    { x0: -1.5, dir: -1, spread: ROAD.spread, zStart: BRANCH_START, zEnd: ROAD.length, halfW: ROAD.branchHalfW, cols: ROAD.branchCols, dropMul: 0.25 },
    { x0: 0, dir: 0, spread: 0, zStart: BRANCH_START, zEnd: ROAD.length, halfW: ROAD.branchHalfW, cols: ROAD.branchCols, dropMul: 0.25 },
    { x0: 1.5, dir: 1, spread: ROAD.spread, zStart: BRANCH_START, zEnd: ROAD.length, halfW: ROAD.branchHalfW, cols: ROAD.branchCols, dropMul: 0.25 }
  ];
  function laneCenter(lane, z) {
    return z <= lane.zStart ? lane.x0 : lane.x0 + lane.dir * lane.spread * (z - lane.zStart);
  }
  function px(lane, lx, y, z) { return project(laneCenter(lane, z) + lx, y, z); }

  // uma célula (bloco) da faixa: topo + espessura 3D + grade sutil + bordas neon
  function drawCell(lane, ll, lr, z0, z1, y, op, i, c) {
    var nl = px(lane, ll, y, z0), nr = px(lane, lr, y, z0);
    var fl = px(lane, ll, y, z1), fr = px(lane, lr, y, z1);
    ctx.globalAlpha = op;

    // topo (asfalto)
    quad(nl, nr, fr, fl);
    ctx.fillStyle = ((i + c) % 2 === 0) ? '#070f0d' : '#050b09';
    ctx.fill();

    // espessura 3D (face frontal) — aparece nos blocos próximos
    var nlb = px(lane, ll, y - ROAD.thick, z0), nrb = px(lane, lr, y - ROAD.thick, z0);
    quad(nl, nr, nrb, nlb);
    ctx.fillStyle = '#030706';
    ctx.fill();

    // grade sutil (textura tech sobre a pista)
    quad(nl, nr, fr, fl);
    ctx.strokeStyle = 'rgba(0,255,174,.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // bordas neon nas pontas da faixa (é o que faz "ler" como estrada)
    var EW = ROAD.edgeW;
    if (c === 0) {
      ctx.shadowColor = GREEN; ctx.shadowBlur = 15; ctx.fillStyle = GREEN;
      quad(nl, px(lane, ll + EW, y, z0), px(lane, ll + EW, y, z1), fl); ctx.fill(); ctx.shadowBlur = 0;
    }
    if (c === lane.cols - 1) {
      ctx.shadowColor = GREEN; ctx.shadowBlur = 15; ctx.fillStyle = GREEN;
      quad(px(lane, lr - EW, y, z0), nr, fr, px(lane, lr - EW, y, z1)); ctx.fill(); ctx.shadowBlur = 0;
    }
    // tracejado central (só na faixa larga, blocos alternados)
    if (lane.cols >= 4 && c === Math.floor(lane.cols / 2) && i % 2 === 0) {
      ctx.shadowColor = GREEN; ctx.shadowBlur = 9; ctx.fillStyle = GREEN;
      quad(px(lane, -0.1, y, z0), px(lane, 0.1, y, z0), px(lane, 0.1, y, z1), px(lane, -0.1, y, z1));
      ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function drawLane(lane) {
    var minI = Math.ceil(lane.zStart / ROAD.seg);
    var maxI = Math.floor(lane.zEnd / ROAD.seg);
    var startI = Math.max(minI, Math.floor((camZ + 0.4) / ROAD.seg));
    var endI = Math.min(maxI, Math.floor((camZ + ROAD.draw) / ROAD.seg));
    var cellW = (2 * lane.halfW) / lane.cols;
    // do mais distante ao mais próximo (near sobrepõe far)
    for (var i = endI; i >= startI; i--) {
      var z0 = i * ROAD.seg;
      var z1 = z0 + ROAD.seg - ROAD.gap;
      if (z1 <= lane.zStart || z0 >= lane.zEnd) continue;
      if (z1 - camZ < 0.4) continue;
      for (var c = 0; c < lane.cols; c++) {
        var phase = ((c % 2) + (i % 3) * 0.5) * ROAD.wave;
        var t = (buildFront - phase - z0) / ROAD.riseBand;
        if (t <= 0) continue;
        if (t > 1) t = 1;
        var e = t * t * (3 - 2 * t);
        // some suave perto do horizonte → sem "espetos"/borda dura ao longe
        var op = e * clamp01((ROAD.draw - (z0 - camZ)) / 11);
        if (op <= 0.012) continue;
        var yOff = -(1 - e) * ROAD.drop * (lane.dropMul || 1);
        var ll = -lane.halfW + c * cellW;
        drawCell(lane, ll, ll + cellW - ROAD.cellGap, z0, z1, yOff, op, i, c);
      }
    }
  }

  function draw() {
    background();
    // bifurcação (mais distante) primeiro, depois a estrada principal por cima
    for (var b = 0; b < BRANCHES.length; b++) drawLane(BRANCHES[b]);
    drawLane(MAIN);
    heroUpdate(target);
  }

  /* ---------- Slogan montado pelas placas (DOM), dirigido pelo scroll ----------
     Cada palavra "nasce" na placa (à direita) e voa até seu lugar no slogan.
     Função pura do progresso → reversível ao rolar de volta. */
  var heroWords = [].slice.call(document.querySelectorAll('.hero h1 .hw'));
  var signEl = document.getElementById('roadSign');
  var signWord = document.getElementById('roadSignWord');
  var heroReady = !!(heroWords.length && signEl && signWord);
  var SEG = [[0.12, 0.22], [0.26, 0.37], [0.41, 0.53], [0.57, 0.69], [0.71, 0.82]];
  var SIGN_END = 0.82;
  var SIGN_FADE = 0.05; // a placa só surge DEPOIS que a estrada começou (não no scroll 0)
  var labels = heroWords.map(function (w) {
    return w.tagName === 'IMG' ? '»»»' : (w.textContent || '').trim().toUpperCase();
  });
  var offs = [];

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(t) { t = clamp01(t); return t * t * (3 - 2 * t); }

  function heroMeasure() {
    if (!heroReady) return;
    for (var i = 0; i < heroWords.length; i++) {
      heroWords[i].style.transform = 'none';
      heroWords[i].style.opacity = '0';
    }
    var prevOp = signEl.style.opacity;
    signEl.style.opacity = '1';
    var sb = signWord.getBoundingClientRect();
    var bx = sb.left + sb.width / 2, by = sb.top + sb.height / 2;
    offs = heroWords.map(function (w) {
      var r = w.getBoundingClientRect();
      return { dx: bx - (r.left + r.width / 2), dy: by - (r.top + r.height / 2) };
    });
    signEl.style.opacity = prevOp || '0';
  }

  function heroUpdate(p) {
    if (!heroReady || !offs.length) return;
    for (var i = 0; i < heroWords.length; i++) {
      var pr = (p - SEG[i][0]) / (SEG[i][1] - SEG[i][0]);
      var t = smooth(pr);
      var o = offs[i];
      heroWords[i].style.transform =
        'translate(' + (o.dx * (1 - t)).toFixed(1) + 'px,' + (o.dy * (1 - t)).toFixed(1) + 'px) scale(' + (0.42 + 0.58 * t).toFixed(3) + ')';
      heroWords[i].style.opacity = clamp01(pr * 1.25).toFixed(3);
    }
    var lbl = '', textOp = 0;
    for (var j = 0; j < heroWords.length; j++) {
      var prj = (p - SEG[j][0]) / (SEG[j][1] - SEG[j][0]);
      if (prj < 1) { lbl = labels[j]; textOp = prj <= 0 ? 1 : (1 - smooth(prj)); break; }
    }
    // a placa surge com fade só após o começo da estrada; some no fim
    var boxOp = clamp01((p - (SEG[0][0] - SIGN_FADE)) / SIGN_FADE);
    if (p >= SIGN_END) boxOp = clamp01(1 - (p - SIGN_END) / 0.07);
    textOp *= boxOp;
    if (lbl && signWord.textContent !== lbl) signWord.textContent = lbl;
    signWord.style.opacity = textOp.toFixed(3);
    signEl.style.opacity = boxOp.toFixed(3);
  }

  // Liga/desliga do efeito placa→slogan. Agora a estrada 3D é limpa (sem placas
  // queimadas), então o efeito fica ativo. Pôr FALSE desliga só esse efeito.
  var HERO_SIGN_FX = true;
  if (!HERO_SIGN_FX || !heroReady) { heroReady = false; revealHeroFallback(); }

  /* ---------- loop ---------- */
  function frame() {
    current += (target - current) * 0.14;
    if (Math.abs(target - current) < 0.0002) current = target;
    setCam();
    draw();
    if (current !== target) requestAnimationFrame(frame);
    else running = false;
  }
  function kick() {
    target = scrollProgress();
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  /* ---------- boot ---------- */
  resize();
  target = current = scrollProgress();
  setCam();
  heroMeasure();
  draw();

  window.addEventListener('scroll', kick, { passive: true });
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      resize(); heroMeasure(); draw(); kick();
    }, 160);
  });
  window.addEventListener('load', function () { heroMeasure(); draw(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { heroMeasure(); draw(); });
  }
  kick();
})();
