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
  if (reduceMotion) { revealHeroFallback(); return; }

  // Dois modos de composição:
  //  - DESKTOP (≥1025px): outdoor de acostamento, pista deslocada p/ a direita.
  //  - MOBILE/retrato (<1025px): PÓRTICO — pista centralizada e as placas vêm POR CIMA
  //    da estrada (como painéis de rodovia), pousando no slogan centralizado.
  // O modo é decidido no boot; girar o aparelho recarrega a cena (ver resize handler).
  var MOBILE = window.innerWidth < 1025;

  document.body.classList.add('journey-on');
  if (MOBILE) document.body.classList.add('journey-m');
  // a cena 3D substitui o poster estático
  var poster = document.querySelector('.road-poster');
  if (poster) poster.style.display = 'none';

  var ctx = canvas.getContext('2d');
  // celular: teto de DPR menor — canvas 2D com glow é caro em telas 3x
  var dpr = Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 2);
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
    length: 240,      // comprimento TOTAL — estrada LONGA: os outdoors são blocos fixos no mundo e precisam de espaçamento p/ aparecer um de cada vez
    base: 6,          // trecho já montado no início
    curve: 0.009,     // curvatura da pista (positivo = varre p/ DIREITA, abrindo a esquerda)
    curveCap: 16,     // teto suave da curva ao longe → a estrada longa não foge da tela
    arriveGap: 92,    // a câmera para no pé da subida; com a estrada longa o avanço por scroll fica ~2.5× mais rápido (os outdoors, fixos no mundo, nascem mais longe)
    rise: 8,          // altura ganha a cada "riseRun" de subida (mundo)
    riseStart: 154,   // z onde a ladeira começa — logo além do fim do percurso da câmera (240−92=148): ela PARA no pé da subida
    riseRun: 34,      // 1ª parte da subida; depois a estrada SEGUE subindo (ladeira longa, sem fim à vista)
    shiftFrac: 0.13,  // desloca SÓ a pista p/ a direita (fração de W): tira a estrada de baixo dos outdoors do centro/direita (vamos, longe), que vinham "dentro da pista". Como o outdoor emerge do centro e não recebe o shift, quanto maior o shift mais folga entre placa e pista
    focal: 0,
    horizon: 0,
    shift: 0          // shiftFrac × W, calculado no resize (px de tela)
  };
  var GREEN = '#00FFAE';

  // Perfil MOBILE/retrato: pista mais estreita e centralizada (o pórtico passa por
  // cima dela), menos colunas e menos distância de desenho (custo por frame).
  if (MOBILE) {
    ROAD.halfW = 1.35;
    ROAD.cols = 4;
    ROAD.draw = 52;
    ROAD.curve = 0.005;
    ROAD.shiftFrac = 0;
  }

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
    // shift BASE (estético). O shift efetivo pode ser MAIOR: heroMeasure() o eleva até
    // a pista ficar fora da área dos outdoors — a largura da pista em px escala com a
    // ALTURA da tela (focal = H·0.8) enquanto o slogan escala com a LARGURA, então em
    // janelas estreitas o desvio fixo não bastava e a placa caía no meio da estrada.
    ROAD.shiftBase = (typeof ROAD._shiftPx === 'number') ? ROAD._shiftPx : Math.round(W * ROAD.shiftFrac);
    ROAD.shift = ROAD.shiftBase;
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
  // A âncora de mundo de cada placa é resolvida da VAGA do próprio texto (descontando
  // o shift da pista e a curva no pass — ver drawOneSign): a do "juntos" vem na mesma
  // lateral que a do "mais" porém mais alta; a do "vamos" na mesma altura porém mais
  // perto da pista — a formação viaja com a estrada já no arranjo em que vai pousar.
  // No retrato a mecânica é a MESMA (a placa viaja na altura da própria vaga e passa
  // por cima do texto); muda só o suporte (L invertido alternando os lados).
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
      var wx = (tx - W / 2) / sPass;
      var wy = ROAD.camH - (ty - ROAD.horizon) / sPass;
      return {
        x: wx,
        y: wy,
        slotX: tx, slotY: ty,            // vaga em px de tela (âncora e teste pista×placa)
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
    fitShiftToSigns();
  }

  // Borda ESQUERDA da pista (sem shift) na linha y da tela, com a pista plana — que é
  // o caso em todo o trecho em que há outdoors ativos (a subida começa em riseStart,
  // além do alcance da câmera durante as placas). Acima do horizonte a pista converge
  // para o ponto de fuga; o clamp de dy cobre isso.
  function roadEdgeXAt(y) {
    var dy = y - ROAD.horizon; if (dy < 8) dy = 8;
    var d = ROAD.camH * ROAD.focal / dy;          // distância da pista nessa linha
    var s = ROAD.focal / d;                       // fator de projeção (= dy / camH)
    return W / 2 + (-ROAD.halfW + curveOffset(camZ + d)) * s;
  }

  // A pista NÃO pode passar por baixo dos outdoors em nenhum tamanho de tela: a largura
  // da pista em px escala com a ALTURA (focal), o slogan com a LARGURA — em janelas
  // estreitas o shift estético não basta. Aqui calculamos, para a caixa de cada placa
  // na posição de pouso (a pior: é onde ela é maior), o quanto falta para a borda
  // esquerda da pista ficar à direita dela, e elevamos o shift até cobrir todas.
  function fitShiftToSigns() {
    // No retrato o pórtico passa POR CIMA da estrada de propósito: pista centralizada.
    if (MOBILE) { ROAD.shift = 0; return; }
    var need = 0, MARGIN = 26;
    // critério 1: a ÂNCORA de viagem de cada placa (derivada da vaga, descontado o
    // shift) precisa cair FORA da pista com margem de mundo — senão a placa viaja em
    // cima da rua. shift ≥ slotX − W/2 + sPass·(halfW + margem − curvaNoPass).
    var sPass = ROAD.focal / D_PASS;
    var c0 = ROAD.curve * D_PASS * D_PASS;
    for (var a = 0; a < signs.length; a++) {
      var needA = signs[a].slotX - W / 2 + sPass * (ROAD.halfW + 0.3 - c0);
      if (needA > need) need = needA;
    }
    // critério 2: a caixa no POUSO fora da pista nas linhas que ela ocupa.
    for (var i = 0; i < signs.length; i++) {
      var sg = signs[i];
      var boxW = sg.targetInnerW * sg.boxWR;
      var boxH = sg.targetInnerW * sg.boxHR;
      var right = sg.slotX + boxW / 2 + MARGIN;
      var yTop = sg.slotY - boxH / 2;
      var yBot = sg.slotY + boxH / 2 + 20;        // um pouco do poste abaixo da caixa
      for (var yy = yTop; yy <= yBot; yy += 10) {
        var falta = right - roadEdgeXAt(yy);
        if (falta > need) need = falta;
      }
    }
    ROAD.shift = Math.max(ROAD.shiftBase, Math.ceil(need));
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

  // Desenha os outdoors NO CANVAS, como PARTE DA ESTRADA: cada placa é um BLOCO fixo
  // no mundo, gerado pelo MESMO método das células da pista — nasce quando a frente
  // de construção a alcança (com uma defasagem por placa, como a "wave" dos blocos),
  // sobe/encaixa com o mesmo smoothstep/drop e usa o mesmo véu de horizonte. Sendo
  // fixa no mundo, a distância dela só diminui porque a câmera avança: move-se POR
  // DEFINIÇÃO na velocidade da estrada, o tempo todo. Pode haver duas em cena (a
  // anterior saindo + a próxima recém-construída ao fundo); a mais funda vem antes.
  function drawSignCanvas(p) {
    if (!heroReady || !signs.length) return;
    if (p >= SIGN_END) return;
    for (var j = heroWords.length - 1; j >= 0; j--) drawOneSign(p, j);
  }

  function drawOneSign(p, j) {
    if (p >= SEG[j][1]) return;
    var sg    = signs[j];
    var prj   = (p - SEG[j][0]) / (SEG[j][1] - SEG[j][0]);   // <0 antes do segmento
    var pPass = SEG[j][0] + PASS * (SEG[j][1] - SEG[j][0]);
    var run   = ROAD.length - ROAD.arriveGap;

    // ---- BLOCO fixo no mundo: z escolhido para dar D_PASS exatos na passagem ----
    var zSign = pPass * run + D_PASS;
    var dist  = zSign - camZ;
    if (dist < 0.3) dist = 0.3;

    // ---- geração pelo MESMO gatilho dos blocos da pista ----
    // t = (frente de construção − z) / riseBand: a placa nasce EXATAMENTE quando a
    // estrada está sendo formada no lugar dela — lá no fundo, junto com o trecho que
    // sobe/encaixa — e não depois, do meio de pista já pronta. Mesmo easing e mesmo
    // "nasce abaixo e sobe" (drop) das células.
    var bfNow = ROAD.base + p * (ROAD.length - ROAD.base);
    var tB = (bfNow - zSign) / ROAD.riseBand;
    if (tB <= 0) return;
    if (tB > 1) tB = 1;
    var eB   = tB * tB * (3 - 2 * tB);
    var yOff = -(1 - eB) * ROAD.drop * 0.8;

    // ---- posição: OBJETO DA ESTRADA de ponta a ponta (sem mescla lateral) ----
    // A âncora de mundo (ax, ay) é resolvida a partir da vaga do texto JÁ DESCONTANDO
    // o deslocamento lateral da pista (ROAD.shift) e a curva no ponto de passagem:
    // o outdoor é um ponto FIXO do mundo que segue a curva/subida da estrada o
    // percurso inteiro — zero deslize horizontal em relação à pista — e, por
    // construção, cai EXATO na vaga no instante da passagem. fitShiftToSigns garante
    // que toda âncora fique FORA da pista, com margem de mundo.
    var z     = camZ + dist;
    var sPass = ROAD.focal / D_PASS;
    var c0    = ROAD.curve * D_PASS * D_PASS;   // curveOffset no ponto de passagem
    var ax = (sg.slotX - ROAD.shift - W / 2) / sPass - c0;
    var ay = sg.y;
    var pt = project(ax + curveOffset(z), ay + roadRise(z) + yOff, z);
    pt.x += ROAD.shift;

    // CHÃO sob a placa (mesma âncora, plano y=0 + a mesma subida): pernas/poste
    // plantados no plano em que os blocos da estrada assentam.
    var groundY = project(ax + curveOffset(z), roadRise(z), z).y;

    // opacidade: construção (o MESMO easing dos blocos — nada de fade próprio) ×
    // véu do horizonte (o mesmo dos blocos ao longe) × saída depois de FADE.
    var op = eB
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

    // suporte plantado no CHÃO (groundY) — o comprimento é caixa→solo, nunca fixo.
    // Desktop: um poste central sob a caixa (outdoor de acostamento). Mobile: braço
    // em L INVERTIDO de UM lado só, alternando (esquerda no "juntos", direita no
    // "vamos"...): o poste sobe do chão ao lado da caixa e o braço horizontal
    // conecta na LATERAL dela, na altura do centro.
    var poleW = Math.max(1, 2 * scale);
    if (MOBILE) {
      var ladoEsq = (j % 2 === 0);
      var arm  = Math.max(6, 24 * scale);                 // braço horizontal do L
      var poX  = ladoEsq ? (x - arm) : (x + boxW + arm);  // onde o poste desce
      var lpH  = Math.max(0, groundY - cy);               // poste: centro da caixa → chão
      if (lpH > 0.5) {
        var pgm = ctx.createLinearGradient(0, cy, 0, cy + lpH);
        pgm.addColorStop(0, 'rgba(0,255,174,.85)');
        pgm.addColorStop(1, 'rgba(0,255,174,.18)');
        ctx.fillStyle = 'rgba(0,255,174,.75)';            // braço: poste → lateral da caixa
        ctx.fillRect(ladoEsq ? poX : x + boxW, cy - poleW / 2, arm, Math.max(1, poleW * 0.9));
        ctx.fillStyle = pgm;
        ctx.fillRect(poX - poleW / 2, cy, poleW, lpH);
      }
    } else {
      var poleH = Math.max(0, groundY - (y + boxH));
      if (poleH > 0.5) {
        var pg = ctx.createLinearGradient(0, y + boxH, 0, y + boxH + poleH);
        pg.addColorStop(0, 'rgba(0,255,174,.85)');
        pg.addColorStop(1, 'rgba(0,255,174,.18)');
        ctx.fillStyle = pg;
        ctx.fillRect(cx - poleW / 2, y + boxH, poleW, poleH);
      }
    }

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

  /* ---------- watchdog de desempenho (mobile) ----------
     Se o aparelho não sustenta a cena (frames consecutivos acima de ~34ms nos
     primeiros 60 quadros de animação), desliga tudo e volta ao layout estático —
     celular fraco nunca vê a animação engasgada. Mede só rajadas contínuas de rAF
     (gap > 200ms é ociosidade entre scrolls, não lentidão). */
  var wdFrames = 0, wdSlow = 0, wdLast = 0, wdDead = !MOBILE;
  function watchdog(now) {
    if (wdDead) return false;
    if (wdLast && now - wdLast < 200) {
      wdFrames++;
      if (now - wdLast > 34) wdSlow++;
      if (wdFrames >= 60) {
        wdDead = true;
        if (wdSlow > 24) { abortScene(); return true; }
      }
    }
    wdLast = now;
    return false;
  }
  function abortScene() {
    heroReady = false;
    canvas.style.display = 'none';
    document.body.classList.remove('journey-on', 'journey-m');
    if (poster) poster.style.display = '';
    revealHeroFallback();
    window.removeEventListener('scroll', kick);
  }

  /* ---------- loop ---------- */
  function frame(now) {
    if (watchdog(now || 0)) { running = false; return; }
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
  var rt, lastW = window.innerWidth, lastH = window.innerHeight;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var w = window.innerWidth, h = window.innerHeight;
      // girou o aparelho / cruzou o limiar de composição → recarrega com o modo certo
      if ((w < 1025) !== MOBILE) { location.reload(); return; }
      // iOS: mostrar/esconder a barra de URL só mexe na ALTURA em poucos px — ignorar
      // evita re-medir (e "pular") a cena no meio da rolagem
      if (w === lastW && Math.abs(h - lastH) < 140) return;
      lastW = w; lastH = h;
      dpr = Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 2);
      resize(); heroMeasure(); draw(); kick();
    }, 160);
  });
  window.addEventListener('load', function () { heroMeasure(); draw(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { heroMeasure(); draw(); });
  }
  kick();
})();
