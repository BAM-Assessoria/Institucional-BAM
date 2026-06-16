/* =============================================================
   BAM Assessoria — JavaScript principal
   Cada módulo só roda se os elementos existirem (multi-página).
   ============================================================= */
(function () {
  'use strict';

  var WHATSAPP = '5511976259165';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Intro (home): logo central → sobe → topbar/whats se constroem ---------- */
  (function () {
    var loader = document.getElementById('loader');
    if (!loader) return;
    var body = document.body;
    var storeLink = document.querySelector('.store-link');
    var menuLabel = document.getElementById('menuLabel');

    // efeito "tipografia se construindo": embaralha e revela da esquerda p/ direita
    function scramble(el, finalText, dur) {
      if (!el) return;
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%/\\><';
      var t0 = null;
      (function step(ts) {
        if (t0 === null) t0 = ts;
        var pr = Math.min(1, (ts - t0) / dur);
        var n = finalText.length, reveal = Math.floor(pr * n), out = '';
        for (var i = 0; i < n; i++) {
          out += (i < reveal || finalText.charAt(i) === ' ')
            ? finalText.charAt(i)
            : chars.charAt(Math.floor(Math.random() * chars.length));
        }
        el.textContent = out;
        if (pr < 1) requestAnimationFrame(step); else el.textContent = finalText;
      })(performance.now ? performance.now() : 0);
      // fallback de tempo (caso o 1º ts não venha): garante o texto final
      setTimeout(function () { el.textContent = finalText; }, dur + 400);
    }

    // movimento reduzido: sem intro, mostra tudo de imediato
    if (reduceMotion) { loader.classList.add('done'); return; }

    body.classList.add('intro-on');
    var started = false;
    function run() {
      if (started) return; started = true;
      var diag = storeLink ? storeLink.textContent.trim() : 'Diagnóstico';
      setTimeout(function () { loader.classList.add('rise'); }, 1200);   // logo sobe
      setTimeout(function () {                                            // topbar + textos se constroem
        loader.classList.add('done');
        body.classList.add('intro-reveal');
        scramble(storeLink, diag, 700);
        scramble(menuLabel, 'Menu', 600);
      }, 2050);
      setTimeout(function () { body.classList.add('intro-wa'); }, 2500);  // whats se constrói
      setTimeout(function () { loader.style.display = 'none'; }, 3100);
    }
    if (document.readyState === 'complete') run();
    else window.addEventListener('load', run);
    setTimeout(run, 1500); // segurança se o 'load' demorar
  })();

  /* ---------- Topbar + barra de progresso ---------- */
  (function () {
    var topbar = document.getElementById('topbar');
    var progress = document.getElementById('progress');
    function onScroll() {
      if (topbar) topbar.classList.toggle('scrolled', window.scrollY > 40);
      if (progress) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.width = (h > 0 ? (window.scrollY / h * 100) : 0) + '%';
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  /* ---------- Menu em tela cheia ---------- */
  (function () {
    var btn = document.getElementById('menuBtn');
    var menu = document.getElementById('menu');
    if (!btn || !menu) return;
    var lab = document.getElementById('menuLabel');
    var open = false;
    function set(o) {
      open = o;
      menu.classList.toggle('open', o);
      if (lab) lab.textContent = o ? 'Fechar' : 'Menu';
      btn.setAttribute('aria-expanded', o ? 'true' : 'false');
      document.body.style.overflow = o ? 'hidden' : '';
    }
    btn.addEventListener('click', function () { set(!open); });
    menu.querySelectorAll('[data-menu]').forEach(function (a) {
      a.addEventListener('click', function () { set(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) set(false);
    });
  })();

  /* ---------- Reveals on scroll (à prova de falhas) ---------- */
  (function () {
    var els = [].slice.call(document.querySelectorAll('.r'));
    if (!els.length) return;
    function reveal(el) { el.classList.add('in'); }
    if (!('IntersectionObserver' in window) || reduceMotion) {
      els.forEach(reveal);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -5% 0px' });
    els.forEach(function (el) { if (!el.classList.contains('in')) io.observe(el); });
    // rede de segurança: revela qualquer .r que esteja na viewport OU já tenha sido
    // rolado para cima (top acima de 95% da tela) — assim nada fica preso invisível.
    function sweep() {
      var h = window.innerHeight || document.documentElement.clientHeight;
      document.querySelectorAll('.r:not(.in)').forEach(function (el) {
        if (el.getBoundingClientRect().top < h * 0.95) { reveal(el); io.unobserve(el); }
      });
    }
    window.addEventListener('scroll', sweep, { passive: true });
    window.addEventListener('resize', sweep);
    window.addEventListener('load', sweep);
    // varredura periódica curta para capturar qualquer caso que o observer perca
    var ticks = 0;
    var iv = setInterval(function () {
      sweep();
      if (++ticks > 24 || !document.querySelector('.r:not(.in)')) clearInterval(iv);
    }, 300);
    sweep();
  })();

  /* ---------- Parallax ---------- */
  (function () {
    var els = [].slice.call(document.querySelectorAll('[data-par]'));
    if (!els.length || reduceMotion) return;
    function up() {
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var c = r.top + r.height / 2 - window.innerHeight / 2;
        el.style.transform = 'translateY(' + (c * -(parseFloat(el.dataset.par) || 0.1)) + 'px)';
      });
    }
    window.addEventListener('scroll', up, { passive: true });
    window.addEventListener('resize', up);
    up();
  })();

  /* ---------- Marquee duplicado ---------- */
  (function () {
    var m = document.getElementById('marq1');
    if (m) m.innerHTML = m.innerHTML + m.innerHTML;
  })();

  /* ---------- Formulários → WhatsApp ---------- */
  function openWhats(text) {
    window.open('https://api.whatsapp.com/send/?phone=' + WHATSAPP + '&text=' +
      encodeURIComponent(text), '_blank', 'noopener');
  }
  (function () {
    var lead = document.getElementById('leadForm');
    if (lead) lead.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      var msg = 'Olá BAM! Quero falar com um especialista.\n\n' +
        'Nome: ' + f.nome.value + '\n' +
        'Email: ' + f.email.value + '\n' +
        'Telefone: ' + f.telefone.value + '\n' +
        'Empresa/Segmento: ' + f.empresa.value + '\n' +
        'Mensagem: ' + f.mensagem.value;
      openWhats(msg);
    });
    var news = document.getElementById('newsForm');
    if (news) news.addEventListener('submit', function (e) {
      e.preventDefault();
      openWhats('Olá BAM! Quero receber insights. Meu email: ' + e.target.news.value);
      e.target.reset();
    });
  })();

  /* ---------- Busca no blog (filtra os cards por título) ---------- */
  (function () {
    var input = document.getElementById('blogSearch');
    if (!input) return;
    var count = document.getElementById('blogCount');
    var empty = document.getElementById('noResults');
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      // reconsulta a cada busca para incluir posts carregados dinamicamente
      var cards = [].slice.call(document.querySelectorAll('[data-post]'));
      cards.forEach(function (card) {
        var hit = card.getAttribute('data-post').indexOf(q) !== -1;
        card.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      if (count) count.textContent = shown + (shown === 1 ? ' artigo' : ' artigos');
      if (empty) empty.style.display = shown === 0 ? 'block' : 'none';
    });
  })();

})();
