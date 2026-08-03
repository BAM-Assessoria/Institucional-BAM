/* =============================================================
   BAM — Portfolio Deck: o leque ABRE quando a seção entra na tela e vira um
   CARROSSEL navegado pelas SETAS (← →), não pelo scroll. Assim a pessoa NÃO
   precisa rolar por todos os cards para sair da seção — basta um scroll.
   2D plano (sem preserve-3d) + z-index inteiro por frame => nenhuma carta
   entra na frente da outra.
   ============================================================= */
(function () {
  'use strict';

  var track = document.getElementById('deckTrack');
  var group = document.getElementById('deckGroup');
  if (!track || !group) return;

  var cards = [].slice.call(group.querySelectorAll('.deck-card'));
  var N = cards.length;
  if (!N) return;

  /* ---- KEEP: mobile / coarse-pointer + reduced-motion early return ---- */
  if (window.matchMedia('(max-width:767px),(pointer:coarse)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  /* ---- carrossel INFINITO: depois da última carta volta a primeira ----
     mod() sempre devolve índice válido (o % do JS é negativo p/ entrada negativa);
     circDist() dá a MENOR distância entre a carta e o centro, indo pelos dois
     lados do círculo, então o leque nunca tem "ponta". */
  function mod(n, m) { return ((n % m) + m) % m; }
  function circDist(i, p) {
    var d = mod(i - p, N);
    return d > N / 2 ? d - N : d;
  }

  var scene = group.parentNode; /* .deck-scene */

  var live = document.createElement('div');
  live.className = 'deck-sr'; live.setAttribute('aria-live', 'polite');
  scene.appendChild(live);

  /* ---- parâmetros do coverflow ---- */
  var small = window.matchMedia('(max-width:1024px)');
  function K() {
    return small.matches
      ? { STEP: 150, FAR: 72, EDGE: 32, SCc: 1.05, SCf: 0.140, SCm: 0.56, ROT: 7, ROTm: 17, TY: 7 }
      : { STEP: 188, FAR: 90, EDGE: 40, SCc: 1.10, SCf: 0.150, SCm: 0.56, ROT: 8, ROTm: 18, TY: 8 };
  }
  function closedPose(i) { return { tx: i * 3, ty: i * -3, rot: i * 0.8, sc: 1 - i * 0.012 }; }
  function carX(d, k) { var s = d < 0 ? -1 : 1, ad = Math.abs(d); if (ad <= 1) return d * k.STEP; if (ad <= 2) return s * (k.STEP + (ad - 1) * k.FAR); return s * (k.STEP + k.FAR + (ad - 2) * k.EDGE); }
  function carPose(i, pos) { var k = K(), d = circDist(i, pos), ad = Math.abs(d); return { tx: carX(d, k), ty: -clamp(d, -3, 3) * k.TY, rot: clamp(d * k.ROT, -k.ROTm, k.ROTm), sc: clamp(k.SCc - ad * k.SCf, k.SCm, k.SCc) }; }

  // O card não mostra texto (o criativo já traz a logo do cliente); o nome vem
  // do data-client, só para o leitor de tela.
  function nameOf(card) {
    var nome = card.getAttribute('data-client');
    if (nome) return nome.trim();
    var el = card.querySelector('.deck-card-name');
    return el ? el.textContent.trim() : 'case';
  }
  function navigate(card) { var h = card.getAttribute('data-href') || 'portifolio.html'; window.location.href = h; }

  var targetIdx = Math.round((N - 1) / 2);   /* abre equilibrado (carta do meio ao centro) */
  var pos = targetIdx;
  var openCur = 0;
  var hoverIndex = -1;
  var raf = null;

  function activeCard() { return cards[mod(Math.round(targetIdx), N)]; }
  function announce() { live.textContent = 'Case ' + (mod(targetIdx, N) + 1) + ' de ' + N + ': ' + nameOf(activeCard()); }
  /* sem trava nas pontas: targetIdx corre livre e o mod cuida do resto */
  function go(delta) { targetIdx += delta; announce(); }

  /* ---- controles de seta (criados no JS; só no desktop animado) ---- */
  var nav = document.createElement('div'); nav.className = 'deck-nav';
  var prev = document.createElement('button'); prev.type = 'button'; prev.className = 'deck-arrow prev'; prev.setAttribute('aria-label', 'Case anterior'); prev.innerHTML = '<span aria-hidden="true">‹</span>';
  var next = document.createElement('button'); next.type = 'button'; next.className = 'deck-arrow next'; next.setAttribute('aria-label', 'Próximo case'); next.innerHTML = '<span aria-hidden="true">›</span>';
  nav.appendChild(prev); nav.appendChild(next); scene.appendChild(nav);
  prev.addEventListener('click', function () { go(-1); });
  next.addEventListener('click', function () { go(1); });

  cards.forEach(function (card, i) {
    card.tabIndex = 0; card.setAttribute('role', 'button'); card.setAttribute('aria-label', 'Ver case ' + nameOf(card));
    if (!card.getAttribute('data-href')) card.setAttribute('data-href', 'portifolio.html');
    card.addEventListener('pointerenter', function () { hoverIndex = i; });
    card.addEventListener('pointerleave', function () { if (hoverIndex === i) hoverIndex = -1; });
    /* clicar numa carta lateral: vai pelo caminho mais curto do círculo */
    function activate() { if (i === mod(targetIdx, N)) navigate(card); else go(circDist(i, targetIdx)); }
    card.addEventListener('click', activate);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); activeCard().focus(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); go(-1); activeCard().focus(); }
    });
  });

  /* ---- ARRASTE com o mouse: segurar e puxar para mover o leque ---- */
  var dragging = false, dragId = -1, dragStartX = 0, dragStartPos = 0, dragMoved = false;
  var DRAG_THRESHOLD = 6; /* px antes de considerar arraste (e não clique) */

  group.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;          /* só botão esquerdo */
    dragging = true; dragMoved = false; dragId = e.pointerId;
    dragStartX = e.clientX; dragStartPos = pos;
    group.classList.add('is-grabbing');
  });

  window.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== dragId) return;
    var dx = e.clientX - dragStartX;
    if (Math.abs(dx) > DRAG_THRESHOLD) dragMoved = true;
    pos = dragStartPos - dx / K().STEP; /* puxar p/ direita => cards anteriores; sem limite: gira sempre */
  });

  function endDrag(e) {
    if (!dragging || (e && e.pointerId !== dragId)) return;
    dragging = false; dragId = -1;
    group.classList.remove('is-grabbing');
    if (dragMoved) { targetIdx = Math.round(pos); announce(); } /* encaixa no mais próximo */
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  /* se houve arraste, cancela o clique (que navegaria/centralizaria o card) */
  group.addEventListener('click', function (e) {
    if (dragMoved) { e.preventDefault(); e.stopPropagation(); dragMoved = false; }
  }, true);

  /* evita o "fantasma" de arrastar imagem nativo do navegador */
  group.addEventListener('dragstart', function (e) { e.preventDefault(); });

  /* abertura = quão CENTRADA a seção está na tela (não move o carrossel).
     Pico quando a seção está no centro do viewport -> some 1 scroll para sair. */
  function openTarget() {
    var r = track.getBoundingClientRect(), vh = window.innerHeight;
    var c = r.top + r.height / 2;
    return clamp(1 - Math.abs(c - vh / 2) / (vh * 0.8), 0, 1);
  }

  var sc = new Array(N), lastZ = new Array(N);

  function tick() {
    openCur = lerp(openCur, openTarget(), 0.12);
    if (!dragging) {
      pos = lerp(pos, targetIdx, 0.16); /* arrastando: pos segue o mouse */
      /* já parou de andar? traz os dois de volta pra faixa 0..N-1, para os
         números não crescerem indefinidamente depois de muitas voltas */
      if (Math.abs(pos - targetIdx) < 0.002) {
        var voltas = Math.floor(targetIdx / N);
        if (voltas !== 0) { targetIdx -= voltas * N; pos -= voltas * N; }
      }
    }
    var active = mod(Math.round(pos), N);
    var open = openCur > 0.55;
    var i;
    for (i = 0; i < N; i++) {
      var cl = closedPose(i), ca = carPose(i, pos);
      var tx = lerp(cl.tx, ca.tx, openCur), ty = lerp(cl.ty, ca.ty, openCur),
          rot = lerp(cl.rot, ca.rot, openCur), scv = lerp(cl.sc, ca.sc, openCur);
      if (open && i === hoverIndex && i !== active) { ty -= 12; }
      cards[i].style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) rotate(' + rot.toFixed(2) + 'deg) scale(' + scv.toFixed(3) + ')';
      sc[i] = scv;
      var dd = Math.abs(circDist(i, pos));
      cards[i].classList.toggle('is-focus', open && i === active);
      cards[i].classList.toggle('is-dimmed', open && dd > 1.5 && i !== hoverIndex);
    }

    /* z-index determinístico por escala (centro por cima); sem empate */
    var order = []; for (i = 0; i < N; i++) order.push(i);
    order.sort(function (a, b) { var d = sc[b] - sc[a]; if (d > 0) return 1; if (d < 0) return -1; return a - b; });
    for (var r = 0; r < N; r++) { var idx = order[r], z = 100 + (N - r); if (lastZ[idx] !== z) { cards[idx].style.zIndex = String(z); lastZ[idx] = z; } }

    /* setas: aparecem com o leque aberto e nunca desabilitam — o giro não tem fim */
    nav.classList.toggle('show', open);

    raf = requestAnimationFrame(tick);
  }

  /* ---- KEEP: IntersectionObserver liga/desliga o rAF ---- */
  var io = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) { if (!raf) raf = requestAnimationFrame(tick); }
    else { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  }, { threshold: 0 });
  io.observe(track);
})();
