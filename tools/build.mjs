/* =============================================================
   BAM Assessoria — Gerador do site estático
   Monta header/footer/head UMA vez e emite todas as páginas como
   HTML estático puro (abre via file:// e hospeda em qualquer host).

   Uso:  node tools/build.mjs
   Fontes de conteúdo:
     - data/posts.json   (posts do blog; ver tools/merge-posts.mjs)
     - data/team.json    (equipe; gerado por tools/fetch-images.mjs)
     - data/clients.json (logos de clientes)
   ============================================================= */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const SITE = {
  name: 'BAM Assessoria em Marketing',
  short: 'BAM',
  url: 'https://www.bamassessoria.com',
  email: 'contato@bamassessoria.com',
  tel: '+5511976259165',
  telDisplay: '11 9 7625-9165',
  whats: '5511976259165',
  addr: 'Rua Aviador Gil Guilherme 38, Bloco 2 — São Paulo / SP',
  instagram: 'https://www.instagram.com/bam.assessoria/',
  linkedin: 'https://www.linkedin.com/company/bam-assessoria-em-marketing',
  facebook: 'https://www.facebook.com/profile.php?id=100086615574875',
};

const J = (p) => existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
const team = J('data/team.json') || [];
const clients = J('data/clients.json') || [];
const posts = (J('data/posts.json') || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s = '') => esc(s).replace(/"/g, '&quot;');
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y) return '';
  return `${d} ${MESES[(m || 1) - 1]} ${y}`;
}
function readingTime(html) {
  const words = String(html).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/* ---------- <head> com CSP (hash do JSON-LD inline) ---------- */
function head({ prefix, title, desc, path, jsonLd, ogType = 'website' }) {
  const ld = jsonLd || JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Organization',
    name: SITE.name, alternateName: 'B.A.M.',
    description: 'Assessoria de marketing de performance: estratégia, tráfego pago, SEO e dados em tempo real.',
    url: SITE.url + '/', email: SITE.email, telephone: SITE.tel, foundingDate: '2022',
    address: { '@type': 'PostalAddress', streetAddress: 'Rua Aviador Gil Guilherme 38, Bloco 2', addressLocality: 'São Paulo', addressRegion: 'SP', addressCountry: 'BR' },
    sameAs: [SITE.instagram, SITE.linkedin, SITE.facebook],
  });
  const ldHash = "'sha256-" + createHash('sha256').update(ld, 'utf8').digest('base64') + "'";
  const csp = [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `script-src 'self' ${ldHash}`,
    "connect-src 'self'",
    "form-action 'self' https://api.whatsapp.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
  const canonical = SITE.url + path;
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${escAttr(desc)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="${prefix}assets/svg/logo-icon.svg" type="image/svg+xml">
<meta property="og:type" content="${ogType}">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="BAM Assessoria">
<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#050505">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${prefix}css/styles.css">
<script type="application/ld+json">${ld}</script>`;
}

/* ---------- Header (topbar + menu) ---------- */
const NAV = [
  ['inicio', 'Início', 'index.html'],
  ['sobre', 'Sobre', 'sobre.html'],
  ['servicos', 'Serviços', 'index.html#servicos'],
  ['cases', 'Cases', 'index.html#cases'],
  ['blog', 'Blog', 'blog/index.html'],
  ['contato', 'Contato', 'index.html#contato'],
];
function header(prefix, active) {
  const links = NAV.map(([k, label, href], i) =>
    `<a href="${prefix}${href}" data-menu${k === active ? ' class="active"' : ''}>${label} <span>${String(i).padStart(2, '0')}</span></a>`
  ).join('\n      ');
  return `<header class="topbar" id="topbar">
  <a href="${prefix}index.html" aria-label="BAM Assessoria — início"><img src="${prefix}assets/svg/logo-wordmark.svg" alt="BAM Assessoria" class="brand-logo" width="120" height="34"></a>
  <div class="topbar-right">
    <a href="${prefix}index.html#contato" class="store-link${active === 'contato' ? ' active' : ''}" data-hover>Diagnóstico</a>
    <button class="menu-btn" id="menuBtn" data-hover aria-label="Abrir menu" aria-expanded="false"><span id="menuLabel">Menu</span><span class="bars" aria-hidden="true"><span></span><span></span></span></button>
  </div>
</header>

<nav class="menu" id="menu" aria-label="Menu principal">
  <div class="menu-grid">
    <div class="menu-links">
      ${links}
    </div>
    <div class="menu-side">
      <div class="menu-tag">Performance digital · desde 2022</div>
      <h4>Contato comercial</h4>
      <a href="mailto:${SITE.email}">${SITE.email}</a>
      <a href="tel:${SITE.tel}">${SITE.telDisplay}</a>
      <p>São Paulo / BR</p>
      <h4 style="margin-top:24px">Siga a BAM</h4>
      <div class="menu-socials">
        <a href="${SITE.instagram}" target="_blank" rel="noopener noreferrer">Instagram</a>
        <a href="${SITE.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a href="${SITE.facebook}" target="_blank" rel="noopener noreferrer">Facebook</a>
      </div>
    </div>
  </div>
</nav>`;
}

function loader(prefix) {
  return `<div id="loader">
  <img src="${prefix}assets/svg/logo-icon.svg" alt="BAM" class="load-logo-img" width="84" height="84">
  <div class="load-bar"><i id="loadFill"></i></div>
  <div class="load-meta" id="loadPct">SYS // 00%</div>
</div>`;
}

function footer(prefix, active) {
  const nav = [['sobre', 'Sobre', 'sobre.html'], ['servicos', 'Serviços', 'index.html#servicos'], ['cases', 'Cases', 'index.html#cases'], ['blog', 'Blog', 'blog/index.html'], ['contato', 'Contato', 'index.html#contato']]
    .map(([k, l, h]) => `<a href="${prefix}${h}"${k === active ? ' class="active"' : ''}>${l}</a>`).join('');
  return `<footer class="bigfoot">
  <span class="scene-edge"></span>
  <div class="wrap">
    <h2 class="r up">Juntos vamos<br>mais <span class="g">longe.</span></h2>
    <div class="foot-cols">
      <div><img src="${prefix}assets/svg/logo-wordmark.svg" alt="BAM Assessoria" class="foot-logo" width="120" height="34"><p class="desc">A inteligência de crescimento por trás de empresas que tratam marketing como investimento.</p></div>
      <div class="foot-col"><h4>Navegação</h4>${nav}</div>
      <div class="foot-col"><h4>Contato</h4><a href="tel:${SITE.tel}">${SITE.telDisplay}</a><a href="mailto:${SITE.email}">${SITE.email}</a><p>${SITE.addr}</p></div>
      <div class="foot-col"><h4>Receba insights</h4><form class="news" id="newsForm"><input type="email" name="news" placeholder="seu@email.com" aria-label="Email" required><button type="submit" aria-label="Inscrever">→</button></form><h4 style="margin-top:22px">Social</h4><a href="${SITE.instagram}" target="_blank" rel="noopener noreferrer">Instagram</a><a href="${SITE.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a></div>
    </div>
    <div class="foot-bot"><span>© 2026 B.A.M. Assessoria em Marketing — Todos os direitos reservados</span><span><a href="${prefix}privacidade.html">Política de Privacidade</a> · SP / BR</span></div>
  </div>
</footer>`;
}

function waFloat() {
  return `<a class="wa-float" href="https://api.whatsapp.com/send/?phone=${SITE.whats}&text=${encodeURIComponent('Olá, quero falar com a BAM')}" target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp" data-hover>
  <svg width="28" height="28" viewBox="0 0 24 24" fill="#000" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.04zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z"/></svg>
</a>`;
}

function page({ prefix, bodyClass = '', title, desc, path, active, hasLoader = false, jsonLd, ogType, content }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
${head({ prefix, title, desc, path, jsonLd, ogType })}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip-link" href="#main">Pular para o conteúdo</a>
<div class="cursor" id="cursor" aria-hidden="true"></div>
<div class="cursor-dot" id="cursorDot" aria-hidden="true"></div>
<div class="progress" id="progress" aria-hidden="true"></div>
${hasLoader ? loader(prefix) + '\n' : ''}${header(prefix, active)}
<span id="top"></span>
<main id="main">
${content}
</main>
${footer(prefix, active)}
${waFloat()}
<script src="${prefix}js/main.js" defer></script>
</body>
</html>
`;
}

/* ===================== conteúdo das páginas ===================== */
const ICON = (prefix) => `${prefix}assets/svg/logo-icon.svg`;

function clientsWall(prefix) {
  const img = (f) => `<img src="${prefix}assets/img/clients/${f}" alt="Cliente BAM" loading="lazy" decoding="async" height="42">`;
  const a = clients.slice(0, 12), b = clients.slice(12);
  const row = (arr) => arr.map(img).join('') + arr.map(img).join('');
  return `<section class="flow">
  <span class="scene-edge"></span>
  <div class="wrap" style="margin-bottom:40px"><span class="tlabel r up">Clientes &amp; parcerias — marcas que crescem com a BAM</span></div>
  <div class="wall-row"><div class="wall-move a">${row(a)}</div></div>
  <div class="wall-row" style="margin-top:30px"><div class="wall-move b">${row(b)}</div></div>
</section>`;
}

function buildHome() {
  const prefix = '';
  const content = `<!-- HERO -->
<section class="scene hero" style="border-top:0;box-shadow:none;border-radius:0">
  <div class="hero-grid" data-par="0.12"></div>
  <div class="hero-glow" data-par="0.22"></div>
  <div class="wrap">
    <div class="hero-eyebrow">
      <span class="tlabel r up in">Assessoria de marketing de performance</span>
      <span class="mono r up in d1" style="font-size:11px;color:var(--gray)">DESDE 2022 · SÃO PAULO / BR</span>
    </div>
    <h1><span class="r clip in">Performance</span><br><span class="r clip in d1">que vira <span class="g">faturamento</span></span><img src="${ICON(prefix)}" alt="" class="hero-chevsvg r scale in d2" aria-hidden="true"></h1>
    <div class="hero-bottom">
      <p class="hero-sub r up in d2">Não somos mais uma agência de execução. Somos a inteligência de crescimento que trata o seu marketing como investimento — e mostra o retorno em tempo real.</p>
      <a href="#contato" class="next-step r up in d3" data-hover><span class="lab">Próximo passo</span><span class="val">Diagnóstico <span class="g">→</span></span></a>
      <div class="scroll-ind">Role <i></i></div>
    </div>
  </div>
</section>

<div class="marquee"><div class="marquee-t" id="marq1"><span>Estratégia</span><span class="dot">›››</span><span>Tráfego Pago</span><span class="dot">›››</span><span>SEO</span><span class="dot">›››</span><span>Conteúdo</span><span class="dot">›››</span><span>Identidade Visual</span><span class="dot">›››</span><span>Dados em Tempo Real</span><span class="dot">›››</span></div></div>

<!-- CASES -->
<section class="cases-h" id="cases">
  <span class="scene-edge"></span>
  <div class="cases-sticky">
    <div class="cases-hint">Arraste / role <span class="arrow">→</span></div>
    <div class="cases-track" id="casesTrack">
      <div class="cpanel intro">
        <div class="ctop"><span>02 — Cases</span><span><b>06</b> resultados</span></div>
        <div><div class="big">RESULTADOS<br><span class="g">EM MOVIMENTO.</span></div><p>Empresas que decidiram tratar o marketing como investimento. Role para o lado.</p></div>
        <img src="${ICON(prefix)}" alt="" class="chevbg" aria-hidden="true">
      </div>
      <div class="cpanel"><div class="cgrid"></div><div class="ctop"><span>Redomo Energia</span><span><b>2024</b></span></div><div class="big"><span class="g">+600%</span></div><div><h3>Tráfego qualificado</h3><p>Captação para projetos B2B com vendas de maior ticket médio, em 30 dias.</p></div><img src="${ICON(prefix)}" alt="" class="chevbg" aria-hidden="true"></div>
      <div class="cpanel quote"><div class="cgrid"></div><div class="q">"Procuramos a BAM para vender mais, mas <span class="g">recebemos muito mais.</span>"</div><div class="qa">Sofie Carmind — Gerente de Contas Internacional</div></div>
      <div class="cpanel green"><div class="cgrid"></div><div class="ctop"><span>Hygge Games</span><span><b>2024</b></span></div><div class="big">+200%</div><div><h3>Engajamento</h3><p>Crescimento no Instagram com conteúdo criativo, elevando a marca no cenário nacional.</p></div></div>
      <div class="cpanel"><div class="cgrid"></div><div class="ctop"><span>Prompt Serviços</span><span><b>2024</b></span></div><div class="big"><span class="g">+80%</span></div><div><h3>Pedidos de orçamento</h3><p>Posicionamento como solução mais confiável em terceirização para síndicos e gestores.</p></div><img src="${ICON(prefix)}" alt="" class="chevbg" aria-hidden="true"></div>
      <div class="cpanel quote"><div class="cgrid"></div><div class="q">"A confiança que faltava. Resultado expressivo em <span class="g">menos de um mês.</span>"</div><div class="qa">Carol Manhães — Assessora de Marketing</div></div>
      <div class="cpanel"><div class="cgrid"></div><div class="ctop"><span>Pq. da Cantareira</span><span><b>2024</b></span></div><div class="big"><span class="g">+40%</span></div><div><h3>Leads qualificados</h3><p>Geração de leads sutil e respeitosa, com redução de 25% no custo por lead (CPL).</p></div><img src="${ICON(prefix)}" alt="" class="chevbg" aria-hidden="true"></div>
      <div class="cpanel green"><div class="cgrid"></div><div class="ctop"><span>Kontainers</span><span><b>2024</b></span></div><div class="big">+60%</div><div><h3>Ticket médio</h3><p>Projetos comerciais de maior valor, com campanhas focadas em clientes de alto potencial.</p></div></div>
      <div class="cpanel quote"><div class="cgrid"></div><div class="q">"Mais do que marketing, é uma empresa que <span class="g">se envolve com o negócio.</span>"</div><div class="qa">Victor Moredo — Gerente de Marketing</div></div>
      <div class="cpanel"><div class="cgrid"></div><div class="ctop"><span>Moredo</span><span><b>2025</b></span></div><div class="big"><span class="g">+20%</span></div><div><h3>Novos clientes</h3><p>Posicionamento fortalecido e entrada consistente de clientes, com visão de longo prazo.</p></div><img src="${ICON(prefix)}" alt="" class="chevbg" aria-hidden="true"></div>
      <div class="cpanel intro"><div class="ctop"><span>Próximo case</span><span><b>VOCÊ</b></span></div><div><div class="big">SEJA O<br><span class="g">PRÓXIMO.</span></div><p>O seu resultado é o nosso próximo case.</p></div><a href="#contato" class="btn" data-hover style="align-self:flex-start"><span>Falar com a BAM</span> <span class="ar">→</span></a></div>
    </div>
  </div>
</section>

<!-- FRENTES -->
<section class="scene">
  <span class="scene-edge"></span>
  <div class="wrap">
    <div class="shead"><span class="idx r up">03 — O que fazemos</span><h2 class="r up">Duas frentes,<br><span class="g">um só objetivo.</span></h2></div>
    <div class="panels">
      <a href="#servicos" class="cat r left" data-hover><div class="cgrid"></div><span class="ctag">Frente 01</span><h2>Perfor<br>mance</h2><div><div class="clist"><span>Tráfego Pago</span><span>Google &amp; Meta Ads</span><span>ROI</span><span>Dados em tempo real</span></div><span class="cgo">Ver capacidades <span class="ar">→</span></span></div></a>
      <a href="#servicos" class="cat r right" data-hover><div class="cgrid"></div><span class="ctag">Frente 02</span><h2>Marca &amp;<br>Conteúdo</h2><div><div class="clist"><span>Branding</span><span>Identidade Visual</span><span>Redes Sociais</span><span>SEO</span></div><span class="cgo">Ver capacidades <span class="ar">→</span></span></div></a>
    </div>
  </div>
</section>

<!-- SERVIÇOS -->
<section class="flow" id="servicos">
  <span class="scene-edge"></span>
  <div class="wrap">
    <div class="shead"><span class="idx r up">03.1 — Capacidades</span><h2 class="r up">Não fazemos posts.<br>Desenhamos <span class="g">planos de negócio.</span></h2><p class="sub r up d1">Passe o mouse para ver o que cada frente entrega.</p></div>
    <div class="caps">
      <div class="cap r up d1" data-hover><span class="cnum">S—01</span><div><h3>Tráfego Pago</h3><div class="out">Google, Meta, TikTok e LinkedIn Ads. Campanhas que reduzem o custo por venda e maximizam o retorno.</div></div><span class="cdef">Ads / Performance</span></div>
      <div class="cap r up d2" data-hover><span class="cnum">S—02</span><div><h3>Landing Pages</h3><div class="out">Páginas desenhadas para converter. Design persuasivo + copy de vendas que geram leads qualificados.</div></div><span class="cdef">Conversão</span></div>
      <div class="cap r up d3" data-hover><span class="cnum">S—03</span><div><h3>SEO</h3><div class="out">Topo do Google de forma orgânica. Autoridade e um fluxo de clientes que não depende só de anúncios.</div></div><span class="cdef">Orgânico</span></div>
      <div class="cap r up d1" data-hover><span class="cnum">S—04</span><div><h3>Design &amp; Identidade</h3><div class="out">Sua marca precisa transmitir confiança antes de vender. Identidade e peças que valorizam o produto.</div></div><span class="cdef">Branding</span></div>
      <div class="cap r up d2" data-hover><span class="cnum">S—05</span><div><h3>Redes Sociais</h3><div class="out">Muito além de likes: relacionamento, autoridade e uma comunidade que compra de você de novo.</div></div><span class="cdef">Social</span></div>
      <div class="cap r up d3" data-hover><span class="cnum">S—06</span><div><h3>Campanhas Sob Medida</h3><div class="out">Lançamentos, datas sazonais e ações de branding. Projetos para o momento específico do negócio.</div></div><span class="cdef">Projetos</span></div>
    </div>
  </div>
</section>

<!-- APP / TRANSPARÊNCIA -->
<section class="scene">
  <span class="scene-edge"></span>
  <div class="scene-wm" aria-hidden="true">Tempo real</div>
  <div class="wrap">
    <div class="feature r scale">
      <span class="tlabel">App exclusivo · em tempo real</span>
      <h2>Transparência <span class="g">total.</span></h2>
      <p>Confiança se constrói com transparência. No nosso aplicativo exclusivo você acompanha 24/7 quanto foi investido, em quê e qual retorno cada campanha gera. Sem relatórios complicados, sem espera.</p>
      <div class="chips"><span>Investimento ao vivo</span><span>Retorno por campanha</span><span>Sem relatório confuso</span><span>24/7</span></div>
      <div class="fcta"><a href="#contato" class="btn" data-hover><span>Quero essa visibilidade</span> <span class="ar">→</span></a></div>
    </div>
  </div>
</section>

${clientsWall(prefix)}

<!-- CONTATO -->
<section class="scene contact" id="contato">
  <span class="scene-edge"></span>
  <div class="contact-glow" data-par="0.18"></div>
  <div class="wrap">
    <div style="text-align:center" class="r up"><span class="tlabel" style="justify-content:center">Juntos vamos mais longe</span></div>
    <h2 class="r up d1" style="margin-top:16px">Vamos crescer <span class="g">juntos?</span></h2>
    <div class="cwrap">
      <div class="ccopy r left d1">
        <span class="tlabel">Fale com um especialista</span>
        <p>Conte sobre o seu momento e receba um diagnóstico estratégico do seu negócio. Sem compromisso, com foco em resultado e retorno sobre investimento.</p>
        <div class="pts"><div>Diagnóstico estratégico gratuito</div><div>Plano de crescimento sob medida</div><div>Acompanhamento em tempo real pelo app</div></div>
      </div>
      <form class="r right d2" id="leadForm" aria-label="Formulário de contato">
        <div class="field"><label for="nome">Nome completo*</label><input id="nome" type="text" name="nome" required placeholder="Seu nome" autocomplete="name"></div>
        <div class="field"><label for="email">Email corporativo*</label><input id="email" type="email" name="email" required placeholder="voce@empresa.com" autocomplete="email"></div>
        <div class="field"><label for="telefone">Telefone*</label><input id="telefone" type="tel" name="telefone" required placeholder="(11) 9 0000-0000" autocomplete="tel"></div>
        <div class="field"><label for="empresa">Nome / Segmento da empresa*</label><input id="empresa" type="text" name="empresa" required placeholder="Empresa e segmento" autocomplete="organization"></div>
        <div class="field"><label for="mensagem">Mensagem*</label><textarea id="mensagem" name="mensagem" required placeholder="Conte um pouco sobre seu momento atual..."></textarea></div>
        <button type="submit" class="btn" data-hover><span>Quero falar com a BAM</span> <span class="ar">→</span></button>
        <p class="form-note">Ao enviar você será direcionado ao nosso WhatsApp com seus dados preenchidos.</p>
      </form>
    </div>
  </div>
</section>`;
  return page({
    prefix, title: SITE.name + ' | Inteligência de Crescimento Digital',
    desc: 'A BAM é a assessoria de marketing de performance que trata o seu marketing como investimento. Estratégia, tráfego pago, SEO, social e dados em tempo real.',
    path: '/', active: 'inicio', hasLoader: true, content,
  });
}

function teamGrid(prefix) {
  const members = team.map((m) =>
    `<div class="member"><img src="${prefix}assets/img/team/${m.img}" alt="${escAttr(m.nome)} — ${escAttr(m.cargo)} da BAM" loading="lazy" decoding="async" width="500" height="667"><div class="ov"><div class="nm">${esc(m.nome)}</div><div class="rl">${esc(m.cargo)}</div></div></div>`
  ).join('');
  return members;
}

function buildSobre() {
  const prefix = '';
  const content = `<header class="page-head">
  <div class="hero-grid" data-par="0.1"></div>
  <div class="hero-glow"></div>
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Você está em"><a href="index.html">Início</a><span class="sep">/</span><span>Sobre</span></nav>
    <h1 class="r up in">Juntos vamos<br>mais <span class="g">longe.</span></h1>
    <p class="lead r up in d1">A BAM nasceu em 2022, da insatisfação com o óbvio. Marketing tratado como investimento, com transparência total — e estratégia comprovada dentro e fora da tela.</p>
  </div>
</header>

<!-- MANIFESTO -->
<section class="section">
  <div class="wrap">
    <span class="idx r up">01 — Mensagem da BAM</span>
    <p class="manifesto" style="margin-top:26px">
      <span class="r clip"><span class="g">Redefinindo</span> o marketing,</span>
      <span class="r clip d1"><span class="muted">brigando por</span> resultado,</span>
      <span class="r clip d2"><span class="g">transformando</span> investimento em faturamento.</span>
      <span class="r clip d3">Construindo legados — dentro e fora da tela.</span>
    </p>
  </div>
</section>

<!-- COMO COMEÇOU -->
<section class="section alt">
  <div class="wrap">
    <div class="shead"><span class="idx r up">02 — Como tudo começou</span><h2 class="r up">Da insatisfação<br>com o <span class="g">óbvio.</span></h2></div>
    <div class="prose r up d1">
      <p>Durante a pandemia da covid-19, muitas empresas correram para o mundo digital para manter as portas abertas. Esse movimento repentino criou uma grande demanda por serviços de comunicação digital — e muita gente viu nesse mercado uma forma de ganhar dinheiro rápido, aplicando estratégias genéricas de cursos relâmpago e cobrando valores exorbitantes dos clientes.</p>
      <p>Diante desse cenário, fundamos a BAM com o propósito de <strong>democratizar o acesso a serviços de marketing de ponta</strong> para micro e pequenas empresas, fundamentando-nos em estratégias comprovadas tanto no ambiente acadêmico quanto no mercado.</p>
      <p>A partir desses conceitos e da aplicação de metodologias ágeis em nosso modelo de negócio, conseguimos integrar novos projetos de maneira rápida e eficiente, otimizando tempo e recursos. O resultado é uma economia significativa de custos, que nos permite oferecer valores mais acessíveis do que os concorrentes.</p>
      <p>Além disso, nos orgulhamos de sermos pioneiros no desenvolvimento de novas tecnologias — como o nosso app de acompanhamento em tempo real — gerando insights valiosos que nos distinguem no mercado.</p>
    </div>
  </div>
</section>

<!-- MISSÃO / VISÃO / VALORES -->
<section class="section">
  <div class="wrap">
    <div class="shead"><span class="idx r up">03 — O que nos move</span><h2 class="r up">Missão, visão<br>e <span class="g">valores.</span></h2></div>
    <div class="mvv">
      <div class="card r up d1"><span class="cnum">01 — Missão</span><h3>Missão</h3><p>Promover o crescimento de pequenas empresas e startups a partir da adoção das nossas soluções de marketing.</p></div>
      <div class="card r up d2"><span class="cnum">02 — Visão</span><h3>Visão</h3><p>Ser uma marca reconhecida no ramo, responsável pelo impulsionamento de novas empresas dos mais diversos setores no mercado.</p></div>
      <div class="card r up d3"><span class="cnum">03 — Valores</span><h3>Valores</h3><ul><li>Consistência em qualidade e entregas</li><li>Atenção a novas tecnologias e estratégias</li><li>Forte embasamento estratégico</li><li>Pensamento fora da caixa</li></ul></div>
    </div>
  </div>
</section>

<!-- COMPROMISSO SOCIAL -->
<section class="section alt">
  <div class="wrap">
    <div class="shead"><span class="idx r up">04 — Compromisso social</span><h2 class="r up">Marketing de qualidade,<br><span class="g">acessível.</span></h2></div>
    <div class="prose r up d1">
      <p>Temos como grande objetivo a <strong>democratização do acesso ao marketing de qualidade</strong> para pequenos negócios. Alcançamos isso com uma estratégia de baixo preço de mercado e alto valor agregado, entregando uma relação custo/benefício superior à dos principais concorrentes.</p>
      <p>Disponibilizamos também, de forma gratuita, conteúdos educativos, artigos e notícias do setor — no portal do nosso site e nas redes sociais — para o desenvolvimento profissional do nosso público.</p>
      <div class="fcta" style="margin-top:30px"><a href="blog/index.html" class="btn ghost" data-hover><span>Ver o blog</span> <span class="ar">→</span></a></div>
    </div>
  </div>
</section>

<!-- TIME -->
<section class="section" id="time">
  <div class="wrap">
    <div class="shead"><span class="idx r up">05 — Time</span><h2 class="r up">Quem pilota a <span class="g">estratégia.</span></h2><p class="sub r up d1">Na BAM você não fala com um robô. Fala com o time responsável por cada decisão do seu crescimento.</p></div>
    <div class="team-grid r up d1">${teamGrid(prefix)}</div>
    <div class="shead r up" style="margin-top:72px;margin-bottom:8px"><span class="idx">05.1 — Fundadores</span></div>
    <div class="founders">
      <div class="founder r up d1"><span class="role">CEO</span><h3>Leonardo Baldin</h3><p>Graduado em Administração (PUC-SP) · Pós em Marketing (ESPM) · MBA Gestão Empresarial (USP)</p></div>
      <div class="founder r up d2"><span class="role">CMO</span><h3>Lucca Almeida</h3><p>Graduado em Publicidade (FEBASP) · Pós em Marketing (ESPM) · Pós em Marketing Digital (ESPM)</p></div>
      <div class="founder r up d3"><span class="role">CTO</span><h3>Natan Michneves</h3><p>Graduado em Marketing (USP) · MBA em Gestão de Projetos e TI (USP)</p></div>
    </div>
    <div class="fcta" style="margin-top:48px"><a href="index.html#contato" class="btn" data-hover><span>Falar com a BAM</span> <span class="ar">→</span></a></div>
  </div>
</section>`;
  return page({
    prefix, title: 'Sobre a BAM | Assessoria de Marketing de Performance',
    desc: 'Conheça a BAM: fundada em 2022 para democratizar o marketing de ponta. Missão, visão, valores e o time por trás da inteligência de crescimento.',
    path: '/sobre.html', active: 'sobre', content,
  });
}

function buildPrivacidade() {
  const prefix = '';
  const content = `<header class="page-head">
  <div class="hero-grid"></div>
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Você está em"><a href="index.html">Início</a><span class="sep">/</span><span>Política de Privacidade</span></nav>
    <h1>Política de <span class="g">Privacidade</span></h1>
    <p class="lead">Como a BAM Assessoria coleta, usa e protege os seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>
  </div>
</header>

<section class="section">
  <div class="wrap">
    <div class="prose center">
      <p><strong>Última atualização:</strong> junho de 2026.</p>
      <p>A sua privacidade é importante para a <strong>BAM Assessoria em Marketing</strong> ("BAM", "nós"). Esta política explica quais dados pessoais tratamos, com qual finalidade e quais são os seus direitos. Ao utilizar este site e nossos canais de contato, você concorda com as práticas aqui descritas.</p>

      <h2>1. Quem é o controlador</h2>
      <p>O controlador dos dados é a BAM Assessoria em Marketing, situada na ${esc(SITE.addr)}. Para qualquer assunto relativo a dados pessoais, fale conosco pelo e-mail <a href="mailto:${SITE.email}">${SITE.email}</a>.</p>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li><strong>Dados que você nos fornece:</strong> nome, e-mail, telefone, empresa/segmento e a mensagem enviada pelo formulário de contato ou pela newsletter. Esses dados são enviados diretamente ao nosso WhatsApp comercial quando você submete o formulário.</li>
        <li><strong>Dados de navegação:</strong> este site é estático e <strong>não utiliza cookies de rastreamento próprios</strong>. Recursos externos (como as fontes do Google Fonts) podem registrar seu endereço IP ao carregar os arquivos, conforme as políticas do respectivo provedor.</li>
      </ul>

      <h2>3. Para que usamos os dados</h2>
      <ul>
        <li>Responder a solicitações de contato e diagnóstico;</li>
        <li>Apresentar propostas e prestar nossos serviços de marketing;</li>
        <li>Enviar conteúdos e novidades, quando você solicita (newsletter);</li>
        <li>Cumprir obrigações legais e regulatórias.</li>
      </ul>

      <h2>4. Base legal</h2>
      <p>Tratamos seus dados com base no seu <strong>consentimento</strong> e na execução de <strong>procedimentos preliminares a um contrato</strong> a seu pedido, nos termos do art. 7º da LGPD.</p>

      <h2>5. Compartilhamento</h2>
      <p>Não vendemos seus dados. Podemos compartilhá-los com operadores que nos apoiam na prestação do serviço (por exemplo, a plataforma de mensagens WhatsApp/Meta), sempre limitados à finalidade informada. Esses terceiros possuem políticas de privacidade próprias.</p>

      <h2>6. Seus direitos</h2>
      <p>Conforme a LGPD, você pode a qualquer momento solicitar: confirmação da existência de tratamento; acesso aos dados; correção de dados incompletos ou desatualizados; anonimização ou eliminação; portabilidade; e revogação do consentimento. Para exercer seus direitos, escreva para <a href="mailto:${SITE.email}">${SITE.email}</a>.</p>

      <h2>7. Retenção e segurança</h2>
      <p>Mantemos os dados apenas pelo tempo necessário às finalidades descritas ou conforme exigido por lei. Adotamos medidas técnicas e organizacionais razoáveis para proteger seus dados contra acesso não autorizado, perda ou alteração.</p>

      <h2>8. Alterações desta política</h2>
      <p>Podemos atualizar esta política periodicamente. A versão vigente estará sempre disponível nesta página, com a data da última atualização.</p>

      <h2>9. Contato</h2>
      <p>Dúvidas sobre esta política ou sobre o tratamento dos seus dados? Fale com a gente: <a href="mailto:${SITE.email}">${SITE.email}</a> · <a href="tel:${SITE.tel}">${SITE.telDisplay}</a>.</p>
    </div>
  </div>
</section>`;
  return page({
    prefix, title: 'Política de Privacidade | BAM Assessoria',
    desc: 'Política de Privacidade da BAM Assessoria em Marketing, em conformidade com a LGPD: quais dados tratamos, finalidade e seus direitos.',
    path: '/privacidade.html', active: null, content,
  });
}

function postCard(prefix, p) {
  const thumb = p.cover
    ? `<div class="thumb"><img src="${prefix}assets/img/blog/${p.cover}" alt="${escAttr(p.title)}" loading="lazy" decoding="async"></div>`
    : `<div class="thumb brand"><img src="${ICON(prefix)}" alt="" aria-hidden="true"></div>`;
  const cat = p.category ? `<span class="pcat">${esc(p.category)}</span>` : '';
  const search = (p.title + ' ' + (p.category || '') + ' ' + (p.excerpt || '')).toLowerCase();
  return `<a class="pcard" href="${prefix}blog/${p.slug}.html" data-post="${escAttr(search)}" data-hover>
  ${thumb}
  <div class="pbody">
    <div class="pmeta">${cat}<span class="date">${fmtDate(p.date)}</span></div>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.excerpt || '')}</p>
    <span class="pgo">Ler artigo <span class="ar">→</span></span>
  </div>
</a>`;
}

function buildBlogIndex() {
  const prefix = '../';
  const cards = posts.map((p) => postCard(prefix, p)).join('\n      ');
  const content = `<header class="page-head">
  <div class="hero-grid" data-par="0.1"></div>
  <div class="hero-glow"></div>
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Você está em"><a href="${prefix}index.html">Início</a><span class="sep">/</span><span>Blog</span></nav>
    <h1 class="r up in">Insights de <span class="g">marketing.</span></h1>
    <p class="lead r up in d1">Conteúdo educativo sobre performance, tráfego, SEO, branding e estratégia — de graça, para o crescimento do seu negócio.</p>
  </div>
</header>

<section class="section">
  <div class="wrap">
    <div class="blog-tools r up">
      <label class="blog-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="search" id="blogSearch" placeholder="Buscar artigo..." aria-label="Buscar artigo">
      </label>
      <span class="blog-count" id="blogCount">${posts.length} artigos</span>
    </div>
    <div class="posts">
      ${cards}
    </div>
    <p class="no-results" id="noResults">Nenhum artigo encontrado.</p>
  </div>
</section>`;
  return page({
    prefix, title: 'Blog | BAM Assessoria em Marketing',
    desc: 'Artigos e insights de marketing de performance, tráfego pago, SEO, branding e estratégia pela BAM Assessoria.',
    path: '/blog/index.html', active: 'blog', content,
  });
}

function buildPost(p, prev, next) {
  const prefix = '../';
  const cover = p.cover
    ? `<div class="article-cover"><img src="${prefix}assets/img/blog/${p.cover}" alt="${escAttr(p.title)}" width="1200" height="675" decoding="async"></div>`
    : '';
  const cat = p.category ? `<span>${esc(p.category)}</span>` : '<span>Marketing</span>';
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: p.title, datePublished: p.date || undefined, inLanguage: 'pt-BR',
    author: { '@type': 'Organization', name: SITE.name },
    publisher: { '@type': 'Organization', name: SITE.name },
    mainEntityOfPage: SITE.url + '/blog/' + p.slug + '.html',
    description: p.excerpt || undefined,
  });
  const content = `<header class="page-head">
  <div class="hero-grid"></div>
  <div class="hero-glow"></div>
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Você está em"><a href="${prefix}index.html">Início</a><span class="sep">/</span><a href="${prefix}blog/index.html">Blog</a><span class="sep">/</span><span>Artigo</span></nav>
    <div class="article" style="margin-top:18px">
      <div class="pmeta" style="font-family:var(--mono);font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--green);display:flex;gap:12px;flex-wrap:wrap">${cat}<span style="color:var(--gray)">${fmtDate(p.date)} · ${readingTime(p.bodyHtml)} min de leitura</span></div>
      <h1 style="font-size:clamp(30px,5.2vw,68px);margin-top:14px">${esc(p.title)}</h1>
    </div>
  </div>
</header>

<article class="section">
  <div class="wrap">
    <div class="article">
      ${cover}
      <div class="prose">
${p.bodyHtml}
      </div>
    </div>
    <div class="article-foot">
      <a class="back" href="${prefix}blog/index.html"><span aria-hidden="true">←</span> Voltar ao blog</a>
      <div style="display:flex;gap:18px">
        ${prev ? `<a class="back" href="${prefix}blog/${prev.slug}.html"><span aria-hidden="true">←</span> Anterior</a>` : ''}
        ${next ? `<a class="back" href="${prefix}blog/${next.slug}.html">Próximo <span aria-hidden="true">→</span></a>` : ''}
      </div>
    </div>
    <div class="article-cta article">
      <h3>Quer resultados como esses no seu <span class="g">negócio?</span></h3>
      <p>Receba um diagnóstico estratégico gratuito e descubra como tratar o seu marketing como investimento.</p>
      <a href="${prefix}index.html#contato" class="btn" data-hover><span>Falar com a BAM</span> <span class="ar">→</span></a>
    </div>
  </div>
</article>`;
  return page({
    prefix, title: p.title + ' | Blog BAM Assessoria',
    desc: p.excerpt || ('Artigo do blog da BAM Assessoria: ' + p.title),
    path: '/blog/' + p.slug + '.html', active: 'blog', ogType: 'article', jsonLd, content,
  });
}

/* ===================== runner ===================== */
mkdirSync('blog', { recursive: true });
writeFileSync('index.html', buildHome());
writeFileSync('sobre.html', buildSobre());
writeFileSync('privacidade.html', buildPrivacidade());
let n = 3;
if (posts.length) {
  writeFileSync('blog/index.html', buildBlogIndex());
  n++;
  posts.forEach((p, i) => {
    const prev = posts[i + 1] || null; // mais antigo
    const next = posts[i - 1] || null; // mais novo
    writeFileSync('blog/' + p.slug + '.html', buildPost(p, prev, next));
    n++;
  });
}
// ---- sitemap.xml + robots.txt ----
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: '/', lastmod: today, prio: '1.0' },
  { loc: '/sobre.html', lastmod: today, prio: '0.8' },
  { loc: '/privacidade.html', lastmod: today, prio: '0.3' },
];
if (posts.length) {
  urls.push({ loc: '/blog/index.html', lastmod: today, prio: '0.7' });
  posts.forEach(p => urls.push({ loc: '/blog/' + p.slug + '.html', lastmod: p.date || today, prio: '0.6' }));
}
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE.url}${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.prio}</priority></url>`).join('\n')}
</urlset>
`;
writeFileSync('sitemap.xml', sitemap);
writeFileSync('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);

console.log(`Gerado: ${n} páginas (${posts.length} posts de blog) + sitemap.xml + robots.txt.`);
console.log(`Equipe: ${team.length} | Clientes: ${clients.length}`);
