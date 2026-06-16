/* =============================================================
   BAM — 3-D Portfolio Deck (vanilla JS, no GSAP)
   Diagonal fan: leftmost card is front/largest, rightmost is back/smallest.
   ============================================================= */
(function () {
  'use strict';

  var track = document.getElementById('deckTrack');
  var group = document.getElementById('deckGroup');
  if (!track || !group) return;

  var cards = [].slice.call(group.querySelectorAll('.deck-card'));
  var N = cards.length;
  if (!N) return;

  if (window.matchMedia('(max-width:767px),(pointer:coarse)').matches) return;

  /* ---- utils ---- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function copyPose(p) { return { tx: p.tx, tz: p.tz, ry: p.ry, sc: p.sc, op: p.op }; }

  /* ---- fan positions: diagonal spread — left/front → right/back ----
     tx spread ~790px total → each card gets ≈158px of visible space       */
  var FAN = [
    { tx: -395, tz:  80, ry: -22, sc: 1.10, op: 1.00 },
    { tx: -220, tz:  40, ry: -13, sc: 1.04, op: 0.96 },
    { tx:  -55, tz:   8, ry:  -4, sc: 0.99, op: 0.91 },
    { tx:   55, tz: -18, ry:   4, sc: 0.94, op: 0.86 },
    { tx:  220, tz: -52, ry:  13, sc: 0.88, op: 0.78 },
    { tx:  395, tz: -88, ry:  22, sc: 0.82, op: 0.70 },
  ];

  /* ---- stack positions: all centered, opacity stagger gives depth ---- */
  var STACK = [
    { tx: 0, tz:  8, ry: 0, sc: 1.00, op: 1.00 },
    { tx: 0, tz:  6, ry: 0, sc: 1.00, op: 0.72 },
    { tx: 0, tz:  4, ry: 0, sc: 1.00, op: 0.58 },
    { tx: 0, tz:  2, ry: 0, sc: 1.00, op: 0.47 },
    { tx: 0, tz:  0, ry: 0, sc: 1.00, op: 0.37 },
    { tx: 0, tz: -2, ry: 0, sc: 1.00, op: 0.28 },
  ];

  function getFanPose(i)   { return FAN[i]   || FAN[FAN.length - 1]; }
  function getStackPose(i) { return STACK[i] || STACK[STACK.length - 1]; }

  /* ---- animated state (starts at stack) ---- */
  var cur = cards.map(function (_, i) { return copyPose(getStackPose(i)); });
  var raf = null;

  function applyPose(card, p) {
    card.style.transform =
      'translateX(' + p.tx.toFixed(1) + 'px)' +
      ' translateZ(' + p.tz.toFixed(1) + 'px)' +
      ' rotateY(' + p.ry.toFixed(2) + 'deg)' +
      ' scale(' + p.sc.toFixed(3) + ')';
    card.style.opacity = p.op.toFixed(3);
  }

  var groupRYCur = 0, groupRYTarget = 0;

  function getProgress() {
    var rect  = track.getBoundingClientRect();
    var trackH = track.offsetHeight;
    var vp    = window.innerHeight;
    return clamp(trackH > vp ? -rect.top / (trackH - vp) : 0, 0, 1);
  }

  var PHASE1_END = 0.40;   /* 0–40%:  stack → fan         */
  var PHASE2_END = 0.72;   /* 40–72%: fan slow pan         */
  var SMOOTH = 0.09;

  function tick() {
    var p = getProgress();
    var targets = [];
    var i;

    if (p <= PHASE1_END) {
      var t1 = ease(p / PHASE1_END);
      for (i = 0; i < N; i++) {
        var sp = getStackPose(i), fp = getFanPose(i);
        targets.push({
          tx: lerp(sp.tx, fp.tx, t1),
          tz: lerp(sp.tz, fp.tz, t1),
          ry: lerp(sp.ry, fp.ry, t1),
          sc: lerp(sp.sc, fp.sc, t1),
          op: lerp(sp.op, fp.op, t1)
        });
      }
      groupRYTarget = 0;

    } else if (p <= PHASE2_END) {
      for (i = 0; i < N; i++) targets.push(copyPose(getFanPose(i)));
      var t2 = (p - PHASE1_END) / (PHASE2_END - PHASE1_END);
      groupRYTarget = lerp(-7, 7, t2);

    } else {
      var t3 = ease((p - PHASE2_END) / (1 - PHASE2_END));
      for (i = 0; i < N; i++) {
        var fp2 = getFanPose(i), sp2 = getStackPose(i);
        var extraZ = i === 2 ? lerp(0, 65, t3) : 0;
        targets.push({
          tx: lerp(fp2.tx, sp2.tx, t3),
          tz: lerp(fp2.tz, sp2.tz, t3) + extraZ,
          ry: lerp(fp2.ry, sp2.ry, t3),
          sc: lerp(fp2.sc, sp2.sc, t3),
          op: lerp(fp2.op, sp2.op, t3)
        });
      }
      groupRYTarget = lerp(7, 0, t3);
    }

    /* smooth lerp to target */
    for (i = 0; i < N; i++) {
      cur[i].tx = lerp(cur[i].tx, targets[i].tx, SMOOTH);
      cur[i].tz = lerp(cur[i].tz, targets[i].tz, SMOOTH);
      cur[i].ry = lerp(cur[i].ry, targets[i].ry, SMOOTH);
      cur[i].sc = lerp(cur[i].sc, targets[i].sc, SMOOTH);
      cur[i].op = lerp(cur[i].op, targets[i].op, SMOOTH);
      applyPose(cards[i], cur[i]);
    }

    groupRYCur = lerp(groupRYCur, groupRYTarget, SMOOTH);
    group.style.transform = 'rotateY(' + groupRYCur.toFixed(2) + 'deg)';

    raf = requestAnimationFrame(tick);
  }

  /* ---- start/stop RAF based on visibility ---- */
  var io = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      if (!raf) raf = requestAnimationFrame(tick);
    } else {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    }
  }, { threshold: 0 });
  io.observe(track);
})();
