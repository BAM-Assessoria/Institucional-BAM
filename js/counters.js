/* =============================================================
   BAM Assessoria — Contadores animados ("count up" no scroll).

   Anima qualquer elemento [data-count] quando ele entra na viewport.
   Atributos:
     data-count    valor final (número cru, ex.: 5400000)
     data-suffix   sufixo colado no fim (ex.: "+", "%", "x")
     data-prefix   prefixo (ex.: "R$ ")
     data-format   "compact" (padrão) → 5.400.000 vira "5.4M"
                   "int"              → 5.400.000 vira "5.400.000"

   Os valores vivem no HTML. Quando a coleta automática das APIs (Google Ads /
   Meta) existir, basta um job reescrever esses data-count — nada aqui muda.
   ============================================================= */
(function () {
  'use strict';

  var els = [].slice.call(document.querySelectorAll('[data-count]'));
  if (!els.length) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DURATION = 1900; // ms da contagem

  // 5.400.000 → "5.4M" | 12.500 → "12.5K" | 940 → "940"
  // Segue o exemplo do briefing ("5.4M+"), com ponto como separador decimal.
  function compact(n) {
    var abs = Math.abs(n), unit = '', div = 1;
    if (abs >= 1e9)      { unit = 'B'; div = 1e9; }
    else if (abs >= 1e6) { unit = 'M'; div = 1e6; }
    else if (abs >= 1e3) { unit = 'K'; div = 1e3; }
    else return String(Math.round(n));
    var v = n / div;
    // uma casa decimal, mas sem ".0" pendurado (7.0M → 7M)
    var s = v.toFixed(1);
    if (s.slice(-2) === '.0') s = s.slice(0, -2);
    return s + unit;
  }

  function int(n) {
    return Math.round(n).toLocaleString('pt-BR');
  }

  function render(el, value) {
    var fmt = el.getAttribute('data-format') === 'int' ? int : compact;
    el.textContent = (el.getAttribute('data-prefix') || '') +
                     fmt(value) +
                     (el.getAttribute('data-suffix') || '');
  }

  // easing de saída: começa rápido e desacelera — dá a sensação de "assentar" no número
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function run(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;

    if (reduceMotion) { render(el, target); return; }

    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / DURATION);
      render(el, target * easeOut(t));
      if (t < 1) requestAnimationFrame(step);
      else render(el, target); // garante o valor exato no fim
    }
    requestAnimationFrame(step);
  }

  // Estado inicial: zerado no formato final, para o bloco não "pular" de largura
  els.forEach(function (el) { render(el, 0); });

  if (!('IntersectionObserver' in window)) {
    els.forEach(run);
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      io.unobserve(en.target); // conta uma vez só
      run(en.target);
    });
  }, { threshold: 0.35 });

  els.forEach(function (el) { io.observe(el); });
})();
