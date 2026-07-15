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
    var ws = document.querySelectorAll('.road-pin h1 .hw');
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
    halfW: 2.7,       // metade da largura da pista
    camH: 1.4,        // altura da câmera acima da pista
    cols: 6,          // colunas da grade (textura tech da pista)
    seg: 1.4,         // profundidade de cada bloco
    gap: 0.08,        // folga em profundidade (pequena → pista contínua, não blocos soltos)
    cellGap: 0.06,    // folga lateral (pequena → vira estrada, não blocos)
    edgeW: 0.18,      // espessura das bordas neon (definem a estrada)
    thick: 0.45,      // espessura 3D do bloco
    draw: 74,         // distância de desenho — revela a ladeira LONGA que sobe ao longe (estrada comprida rumo ao topo)
    riseBand: 7,      // faixa na qual o bloco encaixa
    drop: 2.2,        // quanto o bloco nasce abaixo (menor → mais pista, menos "voando")
    wave: 1.4,        // defasagem da montagem (onda matriz)
    length: 150,      // comprimento TOTAL (estrada longa — há muito caminho pela frente)
    base: 6,          // trecho já montado no início
    curve: 0.009,     // curvatura da pista (positivo = varre p/ DIREITA, abrindo a esquerda)
    curveCap: 16,     // teto suave da curva ao longe → a estrada longa não foge da tela
    arriveGap: 92,    // a câmera para no pé da subida (mesmo enquadramento) e deixa MUITO caminho à frente
    rise: 5.5,        // altura ganha a cada "riseRun" de subida (mundo)
    riseStart: 62,    // z onde a ladeira começa (antes disso a pista é plana, sob a câmera)
    riseRun: 26,      // 1ª parte da subida; depois a estrada SEGUE subindo (ladeira longa, sem fim à vista)
    shiftFrac: 0.13,  // desloca SÓ a pista p/ a direita (fração de W): tira a estrada de baixo dos outdoors do centro/direita (vamos, longe), que vinham "dentro da pista". Como o outdoor emerge do centro e não recebe o shift, quanto maior o shift mais folga entre placa e pista
    focal: 0,
    horizon: 0,
    shift: 0          // shiftFrac × W, calculado no resize (px de tela)
  };
  var GREEN = '#00FFAE';

  // debug: ?roadc= sobrescreve a curvatura; ?roads= sobrescreve o shift lateral da pista (px) p/ calibrar
  (function () {
    var m = /[?&]roadc=(-?[0-9.]+)/.exec(location.search); if (m) ROAD.curve = parseFloat(m[1]);
    var s = /[?&]roads=(-?[0-9.]+)/.exec(location.search); if (s) ROAD._shiftPx = parseFloat(s[1]);
  })();

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ROAD.focal = H * 0.80;
    ROAD.horizon = H * 0.38;
    ROAD.shift = (typeof ROAD._shiftPx === 'number') ? ROAD._shiftPx : Math.round(W * ROAD.shiftFrac);
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
    var dbg = /[?&]roadp=([0-9.]+)/.exec(location.search);
    if (dbg) return Math.min(1, Math.max(0, parseFloat(dbg[1])));
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

    // glow do "destino": brilha LONGE, no alto da subida — sem cobrir a estrada que segue subindo
    if (current > 0.5) {
      var gi = clamp01((current - 0.5) / 0.5);
      var zc = camZ + ROAD.draw * 0.7;                     // ponto distante da pista, já bem no alto
      var cp = project(curveOffset(zc), roadRise(zc), zc);
      var R = H * (0.14 + 0.28 * gi);
      var dg = ctx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, R);
      dg.addColorStop(0, 'rgba(0,255,174,' + (0.10 + 0.26 * gi).toFixed(3) + ')');
      dg.addColorStop(0.5, 'rgba(0,255,174,' + (0.03 + 0.08 * gi).toFixed(3) + ')');
      dg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---- a estrada principal corre inteira e, no fim, SOBE numa ladeira rumo ao topo ----
  var MAIN = { x0: 0, dir: 0, spread: 0, zStart: 0, zEnd: ROAD.length, halfW: ROAD.halfW, cols: ROAD.cols, dropMul: 1 };
  function laneCenter(lane, z) {
    return z <= lane.zStart ? lane.x0 : lane.x0 + lane.dir * lane.spread * (z - lane.zStart);
  }
  // curvatura da pista: cresce com a distância, com TETO suave ao longe (não foge da tela)
  function curveOffset(z) {
    var d = z - camZ; if (d < 0) d = 0;
    var o = ROAD.curve * d * d, cap = ROAD.curveCap;
    return o > cap ? cap + (o - cap) * 0.22 : o;
  }
  // SUBIDA: a partir de riseStart a pista ganha altura e SEGUE subindo cada vez MAIS forte.
  // A 1ª rampa é suave (smoothstep, sob a câmera/placas). Depois dela a altura cresce de forma
  // SUPER-LINEAR (termo e²): isso vence a compressão da perspectiva (1/distância), então a pista
  // continua SUBINDO na tela rumo ao topo no fim da rolagem — em vez de achatar perto do horizonte.
  function roadRise(z) {
    var d = z - ROAD.riseStart; if (d <= 0) return 0;
    var u = d / ROAD.riseRun;
    if (u < 1) return ROAD.rise * u * u * (3 - 2 * u);   // arranque suave (pista plana sob a câmera)
    var e = u - 1;
    return ROAD.rise * (1 + e * 0.85 + e * e * 0.5);     // ladeira longa que acelera rumo ao alto
  }
  function px(lane, lx, y, z) { return project(laneCenter(lane, z) + lx + curveOffset(z), y + roadRise(z), z); }

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
    // A PISTA desloca lateralmente (ROAD.shift); o OUTDOOR não recebe o shift, então
    // assenta na vaga do slogan. Mas ele é desenhado NO MESMO canvas da estrada (mesma
    // camada, mesmo brilho/perspectiva, sob o mesmo scrim) — não é mais um elemento DOM
    // por cima. heroUpdate cuida só do reveal das palavras do slogan (essas são DOM).
    ctx.fillStyle = '#040605';
    ctx.fillRect(0, 0, W, H);           // limpa a tela inteira (antes do translate)
    ctx.save();
    ctx.translate(ROAD.shift, 0);
    background();
    drawLane(MAIN);
    ctx.restore();
    // IMPORTANTE: usar `current` (o MESMO progresso eased que posiciona a câmera/estrada),
    // não `target` — com target a placa andava à frente da pista durante a rolagem e
    // parecia "não acompanhar a estrada".
    drawSignCanvas(current);            // outdoor no canvas, em lockstep com a pista
    heroUpdate(current);                // reveal das palavras (DOM), mesmo relógio
  }

  /* ---------- Slogan montado pelas placas (DOM), dirigido pelo scroll ----------
     Cada palavra tem o SEU outdoor, plantado no mundo numa posição própria — não
     todos na mesma faixa da tela. A posição de cada placa é RESOLVIDA a partir da
     vaga que a palavra ocupa no slogan: procuramos o ponto (x,y) do mundo que, a
     D_PASS metros da câmera, projeta exatamente em cima dessa vaga. Como a placa é
     um objeto estático e só a distância diminui, ela percorre a reta que sai do
     ponto de fuga e passa pela vaga: nasce no horizonte, cresce, COBRE a palavra e
     segue varrendo para fora de cena — deixando a palavra materializada ali.
     Cada vaga está numa altura/lado diferente ⇒ cada outdoor vem por um caminho
     diferente. Função pura do progresso → reversível ao rolar de volta. */
  var heroWords = [].slice.call(document.querySelectorAll('.road-pin h1 .hw'));
  var signEl   = document.getElementById('roadSign');
  var signBox  = document.getElementById('roadSignBox');
  var signWord = document.getElementById('roadSignWord');
  var signLogo = document.getElementById('roadSignLogo');
  var heroReady = !!(heroWords.length && signEl && signBox && signWord);
  var SEG = [[0.12, 0.22], [0.26, 0.37], [0.41, 0.53], [0.57, 0.69], [0.71, 0.82]];
  var SIGN_END = 0.82;

  // Coreografia. O outdoor NASCE NO FUNDO, bem pequenininho, plantado na beira da
  // estrada — mesmo ponto de fuga, mesma curva/subida e o mesmo deslocamento lateral
  // da pista — e vem crescendo por perspectiva (1/dist) até a passagem. A trajetória
  // converge suavemente da "beira da estrada" para a VAGA da palavra: em PASS ele está
  // exatamente sobre a vaga. Depois de PASS ele vira objeto fixo no mundo (a distância
  // só diminui porque a câmera avança) e varre para fora no ritmo da estrada, enquanto
  // a palavra, revelada na passagem, FICA para trás. FADE começa só depois de PASS.
  var D_PASS = 3.2;   // distância (mundo) da placa à câmera no instante da passagem
  var PASS = 0.52;
  var SIGN_ROAD_X = -(ROAD.halfW + 1.15); // acostamento esquerdo (mundo): onde a placa "mora" ao longe
  var SIGN_ROAD_Y = 1.0;                  // altura do centro da placa acima da pista (mundo)
  var FADE = 0.66;
  // Surgimento da palavra sincronizado com a passagem: ele TERMINA no instante em que a
  // placa cobre a vaga (pi = PASS), começando REVEAL_LEAD antes. Assim a palavra já está
  // plena no momento da passagem — e não "logo depois". (Antes o surgimento começava em
  // PASS e levava REVEAL para completar, o que lia como um atraso.)
  var REVEAL = 0.14;       // duração (em prj) do surgimento da palavra
  var REVEAL_LEAD = 0.12;  // quanto do surgimento acontece ANTES da passagem (≈REVEAL → plena no pass)
  // A escala é ancorada no CONTEÚDO da placa (a palavra/logo impressa), não na moldura:
  // no instante da passagem a palavra DENTRO da placa tem exatamente a largura da vaga
  // no slogan (× COVER). Assim, quando a placa "solta" a palavra, ela assenta no mesmo
  // tamanho — sem o salto que havia quando a âncora era a caixa (palavra + padding).
  var COVER = 1.06;    // a palavra na placa cobre 106% da largura da vaga ao passar

  var signs = [];      // um outdoor por palavra: âncora no mundo + escala alvo
  var signLabelIdx = -1;
  var containerOffset = { left: 0, top: 0 }; // viewport offset of sign's parent

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // A última palavra do slogan é a logo (<img>), não texto: a placa dela carrega a
  // própria logo. As demais carregam a palavra em caixa alta.
  function setSignLabel(i) {
    var isLogo = heroWords[i].tagName === 'IMG';
    if (signLogo) signLogo.hidden = !isLogo;
    signWord.hidden = isLogo;
    if (!isLogo) {
      var t = (heroWords[i].textContent || '').trim().toUpperCase();
      if (signWord.textContent !== t) signWord.textContent = t;
    }
    signLabelIdx = i;
  }

  // logo desenhada na placa (canvas): carrega a mesma logo-icon.svg do slogan
  var logoImg = null, logoReady = false;
  if (signLogo) {
    logoImg = new Image();
    logoImg.onload = function () { logoReady = true; draw(); };
    logoImg.src = signLogo.getAttribute('src') || signLogo.src;
  }
  var signFontCss = 48;   // px — font-size da placa (CSS), resolvido na medição

  function heroMeasure() {
    if (!heroReady) return;
    for (var i = 0; i < heroWords.length; i++) {
      heroWords[i].style.transform = 'none';
      heroWords[i].style.opacity = '0';
    }
    var sPass = ROAD.focal / D_PASS;   // fator de projeção no instante da passagem
    signs = heroWords.map(function (w, i) {
      var r  = w.getBoundingClientRect();
      var tx = r.left + r.width  / 2;  // vaga da palavra, em coordenadas de viewport
      var ty = r.top  + r.height / 2;
      // inverso de project(): que ponto do mundo cai sobre esta vaga a D_PASS metros?
      setSignLabel(i);                 // o conteúdo (palavra/logo) muda de dimensões
      var isLogo = w.tagName === 'IMG';
      // Medimos a placa/conteúdo no DOM (offsetWidth/Height — layout, imune ao transform)
      // só para pegar as PROPORÇÕES (caixa↔conteúdo). O desenho em si é no canvas.
      var inner  = (isLogo && signLogo) ? signLogo : signWord;
      var innerW = inner.offsetWidth  || 1;
      var innerH = inner.offsetHeight || 1;
      var boxW0  = signBox.offsetWidth  || innerW;
      var boxH0  = signBox.offsetHeight || innerH;
      if (!isLogo) signFontCss = parseFloat(getComputedStyle(signWord).fontSize) || signFontCss;
      return {
        x: (tx - W / 2) / sPass,
        y: ROAD.camH - (ty - ROAD.horizon) / sPass,
        targetInnerW: r.width * COVER,   // largura on-screen do CONTEÚDO na passagem (× COVER da vaga)
        innerW0: innerW,                 // largura do conteúdo na medida CSS (p/ derivar a escala)
        boxWR: boxW0 / innerW,           // caixa relativa à largura do conteúdo (preserva o padding)
        boxHR: boxH0 / innerW,
        isLogo: isLogo,
        text: isLogo ? '' : (w.textContent || '').trim().toUpperCase(),
        logoAR: isLogo ? (innerH / innerW) : 0
      };
    });
    if (signEl) signEl.style.opacity = '0';   // a placa DOM fica oculta: agora é canvas
  }

  // Reveal das palavras do slogan (DOM). O outdoor (canvas) carrega a palavra até a
  // passagem; aqui a palavra "sólida" do slogan assume, cruzando com a saída da placa.
  function heroUpdate(p) {
    if (!heroReady || !signs.length) return;
    for (var i = 0; i < heroWords.length; i++) {
      var pi  = (p - SEG[i][0]) / (SEG[i][1] - SEG[i][0]);
      var rev = smooth(clamp01((pi - (PASS - REVEAL_LEAD)) / REVEAL));
      heroWords[i].style.transform = 'scale(' + (0.9 + 0.1 * rev).toFixed(3) + ')';
      heroWords[i].style.opacity   = rev.toFixed(3);
    }
  }

  function roundRectPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  // Desenha os outdoors NO CANVAS (mesma camada da estrada). Cada placa tem a SUA
  // janela: nasce logo depois da PASSAGEM da anterior (como outdoors reais — você passa
  // um e o próximo já aparece lá no fundo), o que dá ~2× mais rolagem de aproximação.
  // Pode haver duas em cena (a anterior saindo + a próxima minúscula ao fundo); a mais
  // funda é desenhada primeiro.
  function drawSignCanvas(p) {
    if (!heroReady || !signs.length) return;
    if (p >= SIGN_END) return;
    for (var j = heroWords.length - 1; j >= 0; j--) drawOneSign(p, j);
  }

  function signBorn(j) {
    if (j === 0) return Math.max(0.03, SEG[0][0] - 0.05);
    return SEG[j - 1][0] + PASS * (SEG[j - 1][1] - SEG[j - 1][0]) + 0.015;
  }

  function drawOneSign(p, j) {
    var pBorn = signBorn(j);
    if (p < pBorn || p >= SEG[j][1]) return;
    var sg    = signs[j];
    var prj   = (p - SEG[j][0]) / (SEG[j][1] - SEG[j][0]);   // pode ser <0 antes do segmento
    var pPass = SEG[j][0] + PASS * (SEG[j][1] - SEG[j][0]);
    var tA    = clamp01((p - pBorn) / (pPass - pBorn));      // fração da APROXIMAÇÃO
    var run   = ROAD.length - ROAD.arriveGap;

    // ---- distância: nasce NO FUNDO e desacelera até o RITMO DA ESTRADA ----
    // baseDist é o trilho de objeto FIXO no mundo (z fixo que dá D_PASS na passagem):
    // sobre ele a distância só diminui porque a câmera avança — velocidade da estrada.
    // `extra` é o excedente "vindo do fundo", que decai com (1−tA)³: o cubo concentra a
    // velocidade extra no CAMPO DISTANTE (onde quase não há movimento de tela) e zera
    // valor E derivada antes do campo próximo — o trecho final inteiro roda em cima do
    // trilho fixo, exatamente no fluxo da pista (era o "vem mais rápido que a estrada").
    // O quão fundo pode nascer é limitado pela frente de construção da pista no
    // nascimento (não pode flutuar sobre trecho ainda não montado): nas primeiras
    // palavras a estrada existe ~15 m à frente; nas últimas, ~60 m.
    var baseDist = (pPass * run + D_PASS) - camZ;
    var dist;
    if (p <= pPass) {
      var czB  = pBorn * run;
      var dFar = Math.max(10, Math.min(ROAD.draw * 0.8,
                 (ROAD.base + pBorn * (ROAD.length - ROAD.base)) - czB - 1.5));
      var win  = (pPass - pBorn) * run;
      // teto do excedente proporcional à janela: placas com janela curta (a logo) não
      // podem nascer fundas demais, senão o excesso de velocidade vaza p/ o campo próximo
      var A    = Math.min(Math.max(0, dFar - (D_PASS + win)), 5 * win);
      var k    = 1 - tA;
      dist = baseDist + A * k * k * k;
    } else {
      dist = baseDist;
      if (dist < 0.3) dist = 0.3;
    }

    // ---- posição: mescla "outdoor de beira de estrada" → "pouso na vaga" ----
    // Longe, a placa é um objeto DA CENA: plantada no acostamento esquerdo, com a MESMA
    // curva/subida e o MESMO deslocamento lateral (ROAD.shift) da pista — compartilha o
    // ponto de fuga da estrada e vem no fluxo dela. Perto, a trajetória converge para
    // pousar EXATAMENTE na vaga da palavra no slogan (que não recebe o shift).
    var z  = camZ + dist, zp = camZ + D_PASS;
    var ptRoad = project(SIGN_ROAD_X + curveOffset(z), SIGN_ROAD_Y + roadRise(z), z);
    var ptSlot = project(sg.x + (curveOffset(z) - curveOffset(zp)),
                         sg.y + (roadRise(z)   - roadRise(zp)), z);
    var wMix = p >= pPass ? 1 : smooth(clamp01(prj / PASS));
    var pt = { x: lerp(ptRoad.x + ROAD.shift, ptSlot.x, wMix),
               y: lerp(ptRoad.y,              ptSlot.y, wMix) };

    // opacidade: nada de "surgir por fade" — a placa entra minúscula e cresce; só um
    // anti-pop curtíssimo no nascimento, o véu do horizonte (a MESMA queda usada nos
    // blocos da pista ao longe) e a saída depois de FADE.
    var op = smooth(clamp01(tA / 0.12))
           * clamp01((ROAD.draw - dist) / 11)
           * (1 - smooth(clamp01((prj - FADE) / (1 - FADE))));
    if (op <= 0.004) return;

    var innerOn = sg.targetInnerW * (D_PASS / dist);   // largura do conteúdo agora (tela)
    var scale   = innerOn / sg.innerW0;                // CSS → tela (espessura/raio/glow)
    var boxW = innerOn * sg.boxWR, boxH = innerOn * sg.boxHR;
    var cx = pt.x, cy = pt.y;
    var x = cx - boxW / 2, y = cy - boxH / 2;

    ctx.save();
    ctx.globalAlpha = op;

    // poste (gradiente verde → transparente), atrás da caixa
    var poleH = 74 * scale, poleW = Math.max(1, 2 * scale);
    var pg = ctx.createLinearGradient(0, y + boxH, 0, y + boxH + poleH);
    pg.addColorStop(0, 'rgba(0,255,174,.85)');
    pg.addColorStop(1, 'rgba(0,255,174,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(cx - poleW / 2, y + boxH, poleW, poleH);

    // caixa: fundo escuro + glow externo
    roundRectPath(x, y, boxW, boxH, 12 * scale);
    ctx.shadowColor = 'rgba(0,255,174,.42)';
    ctx.shadowBlur  = 34 * scale;
    ctx.fillStyle   = 'rgba(4,6,5,.72)';
    ctx.fill();
    ctx.shadowBlur  = 0;

    // borda neon
    roundRectPath(x, y, boxW, boxH, 12 * scale);
    ctx.lineWidth   = 2.5 * scale;
    ctx.strokeStyle = GREEN;
    ctx.shadowColor = GREEN;
    ctx.shadowBlur  = 12 * scale;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // conteúdo: logo (imagem) ou palavra (texto Oswald), com glow verde
    if (sg.isLogo) {
      if (logoReady) {
        var lw = innerOn, lh = innerOn * sg.logoAR;
        ctx.shadowColor = 'rgba(0,255,174,.5)';
        ctx.shadowBlur  = 16 * scale;
        ctx.drawImage(logoImg, cx - lw / 2, cy - lh / 2, lw, lh);
        ctx.shadowBlur  = 0;
      }
    } else {
      var fontPx = signFontCss * scale;
      ctx.font = '700 ' + fontPx.toFixed(1) + 'px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      try { ctx.letterSpacing = (0.02 * fontPx).toFixed(2) + 'px'; } catch (e) {}
      ctx.shadowColor = 'rgba(0,255,174,.4)';
      ctx.shadowBlur  = 14 * scale;
      ctx.fillStyle   = 'rgba(228,238,233,.62)';
      ctx.fillText(sg.text, cx, cy + fontPx * 0.02);
      ctx.shadowBlur  = 0;
      try { ctx.letterSpacing = '0px'; } catch (e) {}
    }
    ctx.restore();
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
