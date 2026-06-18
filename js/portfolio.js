/* =============================================================
   BAM Assessoria — Portfólio
   Filtro de categorias + lightbox (visualização ampliada).
   Roda só se a grade existir. Sem dependências externas.
   ============================================================= */
(function () {
  'use strict';

  var grid = document.getElementById('pfGrid');
  if (!grid) return;

  var works = [].slice.call(grid.querySelectorAll('.work'));
  var chips = [].slice.call(document.querySelectorAll('.pf-chip'));
  var empty = document.getElementById('pfEmpty');

  /* ---------- Filtro por categoria ---------- */
  function applyFilter(cat) {
    var shown = 0;
    works.forEach(function (w) {
      var hit = cat === 'all' || w.getAttribute('data-cat') === cat;
      if (hit) { w.removeAttribute('hidden'); shown++; }
      else { w.setAttribute('hidden', ''); }
    });
    if (empty) empty.style.display = shown === 0 ? 'block' : 'none';
  }
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      chip.setAttribute('aria-pressed', 'true');
      applyFilter(chip.getAttribute('data-filter') || 'all');
    });
  });

  /* ---------- Lightbox ---------- */
  var box = document.getElementById('lightbox');
  if (!box) return;
  var img = document.getElementById('lbImg');
  var elTitle = document.getElementById('lbTitle');
  var elSeg = document.getElementById('lbSeg');
  var elCount = document.getElementById('lbCount');
  var btnClose = document.getElementById('lbClose');
  var btnPrev = document.getElementById('lbPrev');
  var btnNext = document.getElementById('lbNext');

  var visible = [];   // trabalhos visíveis (respeita o filtro atual)
  var index = 0;      // posição atual dentro de "visible"
  var lastTrigger = null;

  function visibleWorks() {
    return works.filter(function (w) { return !w.hasAttribute('hidden'); });
  }

  function render() {
    var w = visible[index];
    if (!w) return;
    img.src = w.getAttribute('data-full');
    img.alt = w.querySelector('img') ? w.querySelector('img').alt : (w.getAttribute('data-title') || '');
    if (elTitle) elTitle.textContent = w.getAttribute('data-title') || '';
    if (elSeg) elSeg.textContent = w.getAttribute('data-seg') || '';
    if (elCount) elCount.textContent = (index + 1) + ' / ' + visible.length;
  }

  function open(w) {
    visible = visibleWorks();
    index = visible.indexOf(w);
    if (index < 0) index = 0;
    lastTrigger = w;
    render();
    box.classList.add('open');
    box.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (btnClose) btnClose.focus();
  }

  function close() {
    box.classList.remove('open');
    box.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
  }

  function step(dir) {
    if (!visible.length) return;
    index = (index + dir + visible.length) % visible.length;
    render();
  }

  works.forEach(function (w) {
    w.addEventListener('click', function () { open(w); });
  });
  if (btnClose) btnClose.addEventListener('click', close);
  if (btnPrev) btnPrev.addEventListener('click', function () { step(-1); });
  if (btnNext) btnNext.addEventListener('click', function () { step(1); });

  // clique fora da imagem fecha
  box.addEventListener('click', function (e) {
    if (e.target === box) close();
  });

  document.addEventListener('keydown', function (e) {
    if (!box.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });

  // gesto de arrastar (mobile) para trocar de imagem
  var startX = null;
  box.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    startX = null;
  }, { passive: true });

})();
