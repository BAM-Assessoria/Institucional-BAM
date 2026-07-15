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
    shiftFrac: 0.094, // desloca SÓ a pista p/ a direita (fração de W) — tira a estrada de baixo do outdoor da logo
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
    // A PISTA desloca lateralmente (ROAD.shift), mas os OUTDOORS não: eles ficam
    // ancorados nas vagas do slogan (DOM, via heroUpdate). Assim a estrada sai de
    // baixo do outdoor da logo sem desalinhar o efeito placa→palavra.
    ctx.fillStyle = '#040605';
    ctx.fillRect(0, 0, W, H);           // limpa a tela inteira (antes do translate)
    ctx.save();
    ctx.translate(ROAD.shift, 0);
    background();
    drawLane(MAIN);
    ctx.restore();
    heroUpdate(target);
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

  // Coreografia, em fração do segmento da palavra (prj) e em metros de mundo:
  //   D_FAR → D_PASS → D_EXIT = distância da placa até a câmera.
  // PASS é o instante em que a placa está EXATAMENTE sobre a vaga da palavra. Ele fica
  // ~no MEIO do segmento de propósito: assim, DEPOIS de passar, ainda sobra bastante
  // rolagem (1 − PASS) para a placa CONTINUAR VINDO — ela cresce até D_EXIT (bem perto
  // da câmera) e varre para fora de cena — enquanto a palavra, revelada na passagem,
  // FICA para trás. É a placa que "deixa" a palavra ali, não a palavra que aparece
  // sozinha. FADE começa só depois de PASS, então a placa ainda está sólida no
  // instante em que cobre a vaga, e só se apaga já saindo de quadro.
  var D_FAR = 16, D_PASS = 3.2, D_EXIT = 1.05;
  var PASS = 0.52;
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

  function heroMeasure() {
    if (!heroReady) return;
    for (var i = 0; i < heroWords.length; i++) {
      heroWords[i].style.transform = 'none';
      heroWords[i].style.opacity = '0';
    }
    var cr = signEl.parentElement ? signEl.parentElement.getBoundingClientRect() : { left: 0, top: 0 };
    containerOffset.left = cr.left;
    containerOffset.top  = cr.top;

    var sPass = ROAD.focal / D_PASS;   // fator de projeção no instante da passagem
    signs = heroWords.map(function (w, i) {
      var r  = w.getBoundingClientRect();
      var tx = r.left + r.width  / 2;  // vaga da palavra, em coordenadas de viewport
      var ty = r.top  + r.height / 2;
      // inverso de project(): que ponto do mundo cai sobre esta vaga a D_PASS metros?
      setSignLabel(i);                 // o conteúdo (palavra/logo) muda de largura
      // âncora de escala = largura do CONTEÚDO (não da caixa): na passagem a palavra
      // impressa na placa fica do tamanho da vaga, então assenta sem salto.
      // offsetWidth (largura de layout) e NÃO getBoundingClientRect: este último
      // inclui o transform:scale() que o scrubber escreve na placa a cada frame, o
      // que distorceria a medida (a placa da logo saía gigante por causa disso).
      var inner  = (w.tagName === 'IMG' && signLogo) ? signLogo : signWord;
      var innerW = inner.offsetWidth || signBox.offsetWidth || 1;
      return {
        x: (tx - W / 2) / sPass,
        y: ROAD.camH - (ty - ROAD.horizon) / sPass,
        scale: Math.max(0.35, Math.min(3.4, (r.width * COVER) / innerW))
      };
    });

    // placa começa oculta, no horizonte
    signEl.style.left      = (W / 2 - containerOffset.left) + 'px';
    signEl.style.top       = (ROAD.horizon - containerOffset.top) + 'px';
    signEl.style.transform = 'translate(-50%,-50%) scale(0.1)';
    signEl.style.opacity   = '0';
  }

  function heroUpdate(p) {
    if (!heroReady || !signs.length) return;

    // Palavras: cada uma só se materializa DEPOIS que a SUA placa passou por cima da
    // vaga dela (prj ≥ PASS) — é o texto que estava na placa que "fica para trás".
    for (var i = 0; i < heroWords.length; i++) {
      var pi  = (p - SEG[i][0]) / (SEG[i][1] - SEG[i][0]);
      var rev = smooth(clamp01((pi - (PASS - REVEAL_LEAD)) / REVEAL));
      heroWords[i].style.transform = 'scale(' + (0.9 + 0.1 * rev).toFixed(3) + ')';
      heroWords[i].style.opacity   = rev.toFixed(3);
    }

    // Placa ativa: a da primeira palavra que ainda não fechou o seu segmento
    var activeJ = -1;
    for (var j2 = 0; j2 < heroWords.length; j2++) {
      if ((p - SEG[j2][0]) / (SEG[j2][1] - SEG[j2][0]) < 1) { activeJ = j2; break; }
    }
    if (p >= SIGN_END || activeJ < 0) { signEl.style.opacity = '0'; return; }

    var j   = activeJ;
    var prj = clamp01((p - SEG[j][0]) / (SEG[j][1] - SEG[j][0]));
    var sg  = signs[j];

    // distância: longe → cobre a vaga (D_PASS) → continua vindo e sai de cena (D_EXIT).
    // Na saída uso ease-OUT (t*(2−t)): a placa DESCOBRE a vaga rápido logo após passar,
    // então a palavra (já plena no pass) aparece em sincronia, sem esperar a placa varrer.
    var te = (prj - PASS) / (1 - PASS);
    var dist = prj <= PASS
      ? lerp(D_FAR, D_PASS, smooth(prj / PASS))
      : lerp(D_PASS, D_EXIT, te * (2 - te));

    var pt = project(sg.x, sg.y, camZ + dist);
    // escala em perspectiva ancorada na passagem: em D_PASS a placa cobre a palavra
    var scale = sg.scale * (D_PASS / dist);
    var op = smooth(clamp01(prj / 0.14)) * (1 - smooth(clamp01((prj - FADE) / (1 - FADE))));

    if (signLabelIdx !== j) setSignLabel(j);
    signEl.style.left      = (pt.x - containerOffset.left) + 'px';
    signEl.style.top       = (pt.y - containerOffset.top) + 'px';
    signEl.style.transform = 'translate(-50%,-50%) scale(' + scale.toFixed(3) + ')';
    signEl.style.opacity   = op.toFixed(3);
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
