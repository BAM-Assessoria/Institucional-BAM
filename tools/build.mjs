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

// Cases dos clientes (logo = arquivo em assets/img/clients/ — AJUSTAR p/ o logo correto de cada cliente)
const CASES = [
  { client: 'Hygge Games', year: '2024', metric: '+200%', title: 'Engajamento', desc: 'Crescimento no Instagram com conteúdo criativo, elevando a marca no cenário nacional.', sub: 'Marca internacional de jogos (origem escandinava)', logo: 'Hygge games.webp', photo: 'hygge.jpg' },
  { client: 'Prompt Serviços', year: '2024', metric: '+80%', title: 'Pedidos de orçamento', desc: 'Posicionamento como solução mais confiável em terceirização para síndicos e gestores.', sub: 'Terceirização de portaria e limpeza', logo: 'Prompt.webp', photo: 'prompt.jpg' },
  { client: 'Granitos Moredo', year: '2025', metric: '+20%', title: 'Novos clientes', desc: 'Posicionamento fortalecido e entrada consistente de clientes, com visão de longo prazo.', sub: 'Marmoraria de granitos e mármores desde 1959', logo: 'Granitos moredo.webp', photo: 'moredo.jpeg' },
  { client: 'Novu', year: '2025', metric: 'ROI 50%', title: 'Retorno sobre investimento', desc: 'Com a nova estratégia, resultado expressivo em menos de um mês — o faturamento já superou o investimento.', sub: 'Parceira da BAM em estratégia e performance', logo: '', photo: 'novu.jpg', aria: 'ROI de 50% em menos de dois meses' },
];
const QUOTES = [
  { q: '“Procuramos a BAM para vender mais, mas <span class="g">recebemos muito mais</span>. Eles nos deram um direcionamento criativo que revitalizou nossa comunicação.”', name: 'Sofie Carmind', role: 'Gerente de Contas Internacional', company: 'Hygge Games', result: '<span class="g">+400%</span> de seguidores engajados', photo: 'hygge.jpg' },
  { q: '“Gostaria de parabenizar todos vocês pelo trabalho incrível que vêm fazendo nas campanhas de Ads! O desempenho tem sido cada vez mais consistente, e os <span class="g">resultados falam por si só</span>.”', name: 'Fábio Mansur', role: 'Vice-presidente', company: 'Prompt Serviços', result: '<span class="g">Grande impacto</span> no faturamento e no caixa da empresa', photo: 'prompt.jpg' },
  { q: '“A BAM é uma parceira estratégica importante para a Moredo. Entende bem nosso posicionamento, respeita nossa identidade e entrega um trabalho consistente, com visão de longo prazo. Mais do que marketing, é uma empresa que <span class="g">se envolve com o negócio</span> e contribui para decisões mais assertivas.”', name: 'Victor Moredo', role: 'Gerente de Marketing', company: 'Granitos Moredo', result: '<span class="g">+20%</span> na entrada de novos clientes', photo: 'moredo.jpeg' },
  { q: '“A parceria com a BAM nos trouxe <span class="g">a confiança que faltava</span>. Com a nova estratégia, vimos um resultado expressivo em menos de um mês, com um faturamento que já superou o investimento.”', name: 'Carol Manhães', role: 'Assessora de Marketing', company: 'Novu', result: '<span class="g">ROI de 50%</span> em menos de dois meses', photo: 'novu.jpg' },
];

const J = (p) => existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
const team = J('data/team.json') || [];
const clients = J('data/clients.json') || [];
const posts = (J('data/posts.json') || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

// Portfólio: fonte única para a galeria de portifolio.html e o deck 3D da home.
const pf = J('data/portfolio.json') || { trabalhos: [], deck: [] };
const works = pf.trabalhos || [];
const deckWorks = (pf.deck || [])
  .map(slug => works.find(w => w.slug === slug) || (console.warn(`AVISO: deck aponta para "${slug}", que não existe em trabalhos.`), null))
  .filter(Boolean);

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

/* ---------- portfólio (data/portfolio.json) ---------- */
// Legenda de apoio: a métrica quando o resultado é comprovadamente deste cliente,
// senão a nota do segmento. Nunca a categoria — ela já aparece na etiqueta do card.
function workNote(w) {
  return w.metrica ? `${w.metrica} ${w.resultado || ''}`.trim() : (w.nota || '');
}
function workAlt(w) {
  return `Criativo de ${String(w.tag).toLowerCase()} da BAM para ${w.cliente} — ${w.titulo}`;
}

// Deck 3D da home: só o criativo, sem tarja nem rótulo. Todas as peças já trazem
// a logo ou o @ do cliente no rodapé — o overlay cobria justamente essa marca.
// O cliente vai em data-client: o deck.js lê dali para o leitor de tela.
function deckCards(prefix) {
  return deckWorks.map(w => `        <div class="deck-card" data-client="${escAttr(w.cliente)}"><img src="${prefix}portifolio/web/${w.slug}.webp" alt="${escAttr(workAlt(w))}" loading="lazy" decoding="async"></div>`).join('\n');
}

// Galeria de portifolio.html: título = PEÇA, linha de apoio = CLIENTE.
function portfolioGrid() {
  return works.map(w => {
    // spans (e não divs): o card é um <button>, que só aceita conteúdo de frase
    const metric = w.metrica ? `<span class="wmetric">${esc(w.metrica)}</span>` : '';
    // A legenda fica FORA da imagem: toda peça traz a logo do cliente no rodapé,
    // e o texto sobreposto cobria justamente essa marca.
    return `      <button class="work" data-cat="${escAttr(w.cat)}" data-full="portifolio/web/${w.slug}.webp" data-title="${escAttr(w.titulo)}" data-seg="${escAttr(w.cliente + ' · ' + w.tag)}" aria-label="Ampliar criativo: ${escAttr(w.titulo)} — ${escAttr(w.cliente)}">
        <span class="work-media">
          <img src="portifolio/web/${w.slug}.webp" alt="${escAttr(workAlt(w))}" loading="lazy" decoding="async" width="1080" height="1350">
          <span class="work-cover"></span>
          <span class="work-top"><span class="wtag">${esc(w.tag)}</span><span class="wzoom" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></span>
        </span>
        <span class="work-info"><span class="wtxt"><span class="wt">${esc(w.titulo)}</span><span class="wseg">${esc(w.cliente)}</span></span>${metric}</span>
      </button>`;
  }).join('\n');
}

// Contadores dos filtros — calculados da lista, para não dessincronizarem.
function portfolioFilters() {
  const n = cat => works.filter(w => w.cat === cat).length;
  const chips = [
    ['all', 'Todos', works.length],
    ['social', 'Social Media', n('social')],
    ['campanha', 'Campanhas', n('campanha')],
    ['conteudo', 'Conteúdo &amp; Design', n('conteudo')],
  ];
  return chips.map(([f, label, count]) =>
    `      <button class="pf-chip" type="button" data-filter="${f}" aria-pressed="${f === 'all'}">${label} <span class="c">${count}</span></button>`
  ).join('\n');
}

// portifolio.html é escrito à mão (CSS e textos próprios); o build só reescreve
// os blocos entre os marcadores, para a galeria não divergir do deck da home.
function injectPortfolio() {
  const file = 'portifolio.html';
  if (!existsSync(file)) { console.warn(`AVISO: ${file} não encontrado — galeria não atualizada.`); return false; }
  let html = readFileSync(file, 'utf8');
  const NL = html.includes('\r\n') ? '\r\n' : '\n'; // o arquivo está em CRLF; não misturar
  const blocks = [['PF:FILTROS', portfolioFilters()], ['PF:GALERIA', portfolioGrid()]];
  for (const [tag, content] of blocks) {
    const re = new RegExp(`([ \\t]*<!-- ${tag}:INICIO -->\\r?\\n)[\\s\\S]*?([ \\t]*<!-- ${tag}:FIM -->)`);
    if (!re.test(html)) { console.warn(`AVISO: marcadores ${tag} não encontrados em ${file}.`); return false; }
    const body = content.replace(/\r?\n/g, NL);
    html = html.replace(re, (_, open, close) => `${open}${body}${NL}${close}`);
  }
  writeFileSync(file, html);
  return true;
}

/* ---------- <head> com CSP (hash do JSON-LD inline) ---------- */
function head({ prefix, title, desc, path, jsonLd, ogType = 'website', firebase = false, noindex = false }) {
  const ld = jsonLd || JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Organization',
    name: SITE.name, alternateName: 'B.A.M.',
    description: 'Assessoria de marketing de performance: estratégia, tráfego pago, SEO e dados em tempo real.',
    url: SITE.url + '/', email: SITE.email, telephone: SITE.tel, foundingDate: '2022',
    address: { '@type': 'PostalAddress', streetAddress: 'Rua Aviador Gil Guilherme 38, Bloco 2', addressLocality: 'São Paulo', addressRegion: 'SP', addressCountry: 'BR' },
    sameAs: [SITE.instagram, SITE.linkedin, SITE.facebook],
  });
  const ldHash = "'sha256-" + createHash('sha256').update(ld, 'utf8').digest('base64') + "'";
  // Páginas que leem posts do Firestore (blog dinâmico) precisam liberar os
  // domínios do Firebase no CSP. As demais seguem com a política mais restrita.
  const FB_SCRIPT = ' https://www.gstatic.com';
  const FB_CONNECT = ' https://firestore.googleapis.com https://firebasestorage.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com';
  const FB_IMG = ' https://firebasestorage.googleapis.com https://storage.googleapis.com';
  // App Check com reCAPTCHA v3: o script vem de google.com/gstatic, o token é
  // trocado em content-firebaseappcheck e o reCAPTCHA monta um IFRAME INVISÍVEL
  // em google.com — sem `frame-src` ele cairia no default-src 'self' e o App
  // Check nunca conseguiria emitir token.
  const AC_SCRIPT = ' https://www.google.com'; // gstatic já vem de FB_SCRIPT
  const AC_CONNECT = ' https://content-firebaseappcheck.googleapis.com';
  const AC_FRAME = ' https://www.google.com https://recaptcha.google.com';
  // Tag "Meu Site" (BAM-MKT): loader + rrweb (CDN) e endpoints de coleta (config/ingest).
  const MS_SCRIPT = ' https://bammarketing.web.app https://cdn.jsdelivr.net';
  const MS_CONNECT = ' https://southamerica-east1-projeto3-lr5vjl.cloudfunctions.net';
  // GA4 (gtag.js). Vai em TODAS as páginas, mas só dispara depois do aceite no
  // banner de consentimento — ver js/consent.js.
  const GA_SCRIPT = ' https://www.googletagmanager.com';
  const GA_CONNECT = ' https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googletagmanager.com';
  const GA_IMG = ' https://www.google-analytics.com https://www.googletagmanager.com';
  const csp = [
    "default-src 'self'",
    "img-src 'self' data:" + (firebase ? FB_IMG : '') + GA_IMG,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `script-src 'self' ${ldHash}` + (firebase ? FB_SCRIPT + AC_SCRIPT : '') + MS_SCRIPT + GA_SCRIPT,
    "connect-src 'self'" + (firebase ? FB_CONNECT + AC_CONNECT : '') + MS_CONNECT + GA_CONNECT,
    "frame-src 'self'" + (firebase ? AC_FRAME : ''),
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
<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow'}">
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
<script async src="https://bammarketing.web.app/bam-replay-loader.js" data-site-key="sk_-2AaWDaECuD1k7XG4QjzBISaQZA2lJcP"></script>
<script type="application/ld+json">${ld}</script>`;
}

/* ---------- Header (topbar + menu) ---------- */
const NAV = [
  ['inicio', 'Início', 'index.html'],
  ['sobre', 'Sobre', 'sobre.html'],
  ['servicos', 'Serviços', 'index.html#servicos'],
  ['portfolio', 'Portfólio', 'portifolio.html'],
  ['blog', 'Blog', 'blog/index.html'],
  ['contato', 'Contato', 'contato.html'],
];
function header(prefix, active, portfolio = true) {
  const items = portfolio ? NAV : NAV.filter(([k]) => k !== 'portfolio');
  const links = items.map(([k, label, href], i) =>
    `<a href="${prefix}${href}" data-menu${k === active ? ' class="active"' : ''}>${label} <span>${String(i).padStart(2, '0')}</span></a>`
  ).join('\n      ');
  return `<header class="topbar" id="topbar">
  <a href="${prefix}index.html" aria-label="BAM Assessoria — início"><img src="${prefix}assets/svg/logo-wordmark.svg" alt="BAM Assessoria" class="brand-logo" width="120" height="34"></a>
  <div class="topbar-right">
    <a href="${prefix}contato.html" class="store-link${active === 'contato' ? ' active' : ''}" data-hover>Diagnóstico</a>
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
  <img src="${prefix}assets/svg/logo-wordmark.svg" alt="BAM Assessoria" class="intro-logo" width="200" height="56">
  <div class="intro-arrow" aria-hidden="true"><i></i></div>
</div>`;
}

function footer(prefix, active, portfolio = true) {
  const items = [['sobre', 'Sobre', 'sobre.html'], ['servicos', 'Serviços', 'index.html#servicos'], ['portfolio', 'Portfólio', 'portifolio.html'], ['blog', 'Blog', 'blog/index.html'], ['contato', 'Contato', 'contato.html']];
  const nav = (portfolio ? items : items.filter(([k]) => k !== 'portfolio'))
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
    <div class="foot-bot"><span>© 2026 B.A.M. Assessoria em Marketing — Todos os direitos reservados</span><span><a href="${prefix}privacidade.html">Política de Privacidade</a> · <a href="#" data-cookies>Cookies</a> · SP / BR</span></div>
  </div>
</footer>`;
}

function waFloat() {
  return `<a class="wa-float" href="https://api.whatsapp.com/send/?phone=${SITE.whats}&text=${encodeURIComponent('Olá, quero falar com a BAM')}" target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp" data-hover>
  <svg width="28" height="28" viewBox="0 0 24 24" fill="#000" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.04zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z"/></svg>
</a>`;
}

// `chrome: false` gera a página sem menu, rodapé e botão flutuante do WhatsApp.
// Serve para landing pages, onde cada link a mais é uma rota de fuga da conversão.
function page({ prefix, bodyClass = '', title, desc, path, active, hasLoader = false, jsonLd, ogType, content, firebase = false, noindex = false, extraScripts = '', portfolio = true, chrome = true }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
${head({ prefix, title, desc, path, jsonLd, ogType, firebase, noindex })}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip-link" href="#main">Pular para o conteúdo</a>
<div class="progress" id="progress" aria-hidden="true"></div>
${hasLoader ? loader(prefix) + '\n' : ''}${chrome ? header(prefix, active, portfolio) : ''}
<span id="top"></span>
<main id="main">
${content}
</main>
${chrome ? footer(prefix, active, portfolio) : ''}
${chrome ? waFloat() : ''}
<script src="${prefix}js/main.js" defer></script>
<script type="module" src="${prefix}js/consent.js"></script>
${extraScripts}</body>
</html>
`;
}

/* ===================== conteúdo das páginas ===================== */
const ICON = (prefix) => `${prefix}assets/svg/logo-icon.svg`;

// Logos reais dos clientes na ordem da faixa (arquivos em assets/img/clients/).
// Mantido aqui (e não em data/clients.json) para preservar a ordem curada e os nomes reais.
const CLIENT_LOGOS = [
  'Adrifer.webp', 'Atlas.webp', 'Biosensu.webp', 'Cemiterio cantareira.webp', 'Croasonho.webp',
  'Eccho.webp', 'Elage.webp', 'Electro-tec.webp', 'Engenheiro murilo.webp', 'Gli Consórcios.webp',
  'Grance.webp', 'Granitos moredo.webp', 'Habitech.webp', 'Hygge games.webp', 'Kontainers Construções.webp',
  'MGl .webp', 'O que será.webp', 'Planet korea.webp', 'Promanage.webp', 'Prompt.webp',
  'Solar café.webp', 'STS Logistica.webp', 'Tomazini.webp', 'Café sao francisco.webp',
];

function clientsWall(prefix) {
  const img = (f) => `<img src="${prefix}assets/img/clients/${f}" alt="${escAttr(f.replace(/\.webp$/, '').trim())}" loading="lazy" decoding="async" height="42">`;
  // uma única faixa com todos os clientes (duplicada para o loop contínuo)
  const row = CLIENT_LOGOS.map(img).join('') + CLIENT_LOGOS.map(img).join('');
  return `<section class="flow clients">
  <span class="scene-edge"></span>
  <div class="wrap" style="margin-bottom:34px"><span class="tlabel r up">Clientes &amp; parcerias — marcas que crescem com a BAM</span></div>
  <div class="wall-row"><div class="wall-move a">${row}</div></div>
</section>`;
}

function buildHome() {
  const prefix = '';
  const content = `<!-- CANVAS ESTRADA (desktop) -->
<div class="road-stage" aria-hidden="true">
  <canvas id="roadCanvas"></canvas>
  <div class="road-scrim"></div>
</div>

<!-- HERO + ESTRADA 3D -->
<section class="road-journey" id="roadTrack">
  <div class="road-pin">
    <div class="wrap">
      <h1>
        <span class="hw">Juntos</span> <span class="hw">vamos</span><br>
        <span class="hw">mais</span> <span class="hw g">longe</span><br>
        <img src="${ICON(prefix)}" alt="" class="hw hero-chevsvg" aria-hidden="true">
      </h1>
      <!-- Outdoor da estrada: carrega a palavra da vez. Na última placa o conteúdo
           é a logo (o mesmo chevron que fecha o slogan), não texto. -->
      <div id="roadSign" class="road-sign">
        <div id="roadSignBox" class="road-sign-box">
          <span id="roadSignWord" class="road-sign-word"></span>
          <img id="roadSignLogo" class="road-sign-logo" src="${ICON(prefix)}" alt="" aria-hidden="true" hidden>
        </div>
        <div class="road-sign-pole"></div>
      </div>
    </div>
  </div>
</section>

<!-- 3D PORTFOLIO DECK -->
<section class="deck-journey" id="deckTrack">
  <div class="deck-pin">
    <div class="wrap deck-head-wrap">
      <span class="idx tlabel r up">02 — Portfolio</span>
      <h2 class="r up d1" style="font-family:var(--disp);font-weight:700;text-transform:uppercase;font-size:clamp(24px,3.6vw,52px);line-height:1.06;margin-top:10px">Cases que <span class="g">falam por si.</span></h2>
      <a href="${prefix}portifolio.html" class="btn ghost r up d2" data-hover style="margin-top:18px"><span>Ver portfólio completo</span> <span class="ar">→</span></a>
    </div>
    <div class="deck-scene">
      <div class="deck-group" id="deckGroup">
${deckCards(prefix)}
      </div>
    </div>
  </div>
</section>

<div class="marquee"><div class="marquee-t" id="marq1"><span>Estratégia</span><span class="dot">›››</span><span>Tráfego Pago</span><span class="dot">›››</span><span>SEO</span><span class="dot">›››</span><span>Conteúdo</span><span class="dot">›››</span><span>Identidade Visual</span><span class="dot">›››</span><span>Dados em Tempo Real</span><span class="dot">›››</span></div></div>

<!-- CASES -->
<section class="cases" id="cases">
  <span class="scene-edge"></span>
  <div class="wrap">
    <div class="shead"><span class="idx r up">02 — Cases</span><h2 class="r up">Resultados<br><span class="g">em movimento.</span></h2><p class="sub r up d1">Empresas que decidiram tratar o marketing como investimento.</p></div>
    <div class="case-grid">
      ${CASES.map((c, i) => `<article class="case-card r up${i % 3 === 1 ? ' d1' : i % 3 === 2 ? ' d2' : ''}" tabindex="0" aria-label="${escAttr(c.client)} — ${c.aria ? escAttr(c.aria) : `${escAttr(c.metric)} ${escAttr(c.title)}`}">
        <div class="case-flip">
          <div class="case-face case-front">
            <div class="case-front-top">
              ${c.logo ? `<img class="case-logo" src="${prefix}assets/img/clients/${c.logo}" alt="${escAttr(c.client)}" loading="lazy" decoding="async" height="56">\n              ` : ''}${c.photo ? `<img class="case-avatar" src="${prefix}depoimentos/${c.photo}" alt="Depoimento — ${escAttr(c.client)}" loading="lazy" decoding="async">` : ''}
            </div>
            <span class="case-client">${esc(c.client)}</span>
            ${c.sub ? `<span class="case-sub">${esc(c.sub)}</span>` : ''}
            <span class="case-hint">Ver resultado →</span>
          </div>
          <div class="case-face case-back">
            <div class="cgrid"></div>
            <div class="case-top">${c.logo ? `<img class="case-logo" src="${prefix}assets/img/clients/${c.logo}" alt="" loading="lazy" decoding="async" height="30">` : ''}<span class="case-year">${esc(c.year)}</span></div>
            <span class="case-client">${esc(c.client)}</span>
            <div class="case-metric"><span class="g">${esc(c.metric)}</span></div>
            <h3>${esc(c.title)}</h3>
            <p>${esc(c.desc)}</p>
          </div>
        </div>
      </article>`).join('\n      ')}
    </div>
    <div class="case-quotes">
      ${QUOTES.map((q) => `<figure class="case-quote r up">
        <img class="quote-photo" src="${prefix}depoimentos/${q.photo}" alt="${escAttr(q.name + ' — ' + q.company)}" loading="lazy" decoding="async">
        <blockquote>${q.q}</blockquote>
        <div class="quote-result">${q.result}</div>
        <figcaption>${esc(q.name)} — ${esc(q.role)} · ${esc(q.company)}</figcaption>
      </figure>`).join('\n      ')}
    </div>
    <div class="case-next r up">
      <div><span class="tlabel">Próximo case</span><h3>Seja o <span class="g">próximo.</span></h3><p>O seu resultado é o nosso próximo case.</p></div>
      <a href="#contato" class="btn" data-hover><span>Falar com a BAM</span> <span class="ar">→</span></a>
    </div>
  </div>
</section>

<!-- FRENTES -->
<section class="scene">
  <span class="scene-edge"></span>
  <div class="wrap">
    <div class="shead"><span class="idx r up">03 — O que fazemos</span><h2 class="r up">Duas frentes,<br><span class="g">um só objetivo.</span></h2></div>
    <div class="panels">
      <a href="#servicos" class="cat r left" data-hover><div class="cgrid"></div><span class="ctag">Frente 01</span><h2>Performance</h2><div><div class="clist"><span>Tráfego Pago</span><span>Google &amp; Meta Ads</span><span>ROI</span><span>Dados em tempo real</span></div><span class="cgo">Ver capacidades <span class="ar">→</span></span></div></a>
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
      <a class="cap r up d1" href="${prefix}servicos/trafego-pago.html" data-hover><span class="cnum">S—01</span><div><h3>Tráfego Pago</h3><div class="out">Google, Meta, TikTok e LinkedIn Ads. Campanhas que reduzem o custo por venda e maximizam o retorno.</div></div><span class="cdef">Ads / Performance</span></a>
      <a class="cap r up d2" href="${prefix}servicos/landing-pages.html" data-hover><span class="cnum">S—02</span><div><h3>Landing Pages</h3><div class="out">Páginas desenhadas para converter. Design persuasivo + copy de vendas que geram leads qualificados.</div></div><span class="cdef">Conversão</span></a>
      <a class="cap r up d3" href="${prefix}servicos/seo.html" data-hover><span class="cnum">S—03</span><div><h3>SEO</h3><div class="out">Topo do Google de forma orgânica. Autoridade e um fluxo de clientes que não depende só de anúncios.</div></div><span class="cdef">Orgânico</span></a>
      <a class="cap r up d1" href="${prefix}servicos/design-identidade.html" data-hover><span class="cnum">S—04</span><div><h3>Design &amp; Identidade</h3><div class="out">Sua marca precisa transmitir confiança antes de vender. Identidade e peças que valorizam o produto.</div></div><span class="cdef">Branding</span></a>
      <a class="cap r up d2" href="${prefix}servicos/redes-sociais.html" data-hover><span class="cnum">S—05</span><div><h3>Redes Sociais</h3><div class="out">Muito além de likes: relacionamento, autoridade e uma comunidade que compra de você de novo.</div></div><span class="cdef">Social</span></a>
      <a class="cap r up d3" href="${prefix}servicos/campanhas-sob-medida.html" data-hover><span class="cnum">S—06</span><div><h3>Campanhas Sob Medida</h3><div class="out">Lançamentos, datas sazonais e ações de branding. Projetos para o momento específico do negócio.</div></div><span class="cdef">Projetos</span></a>
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
      <p>Confiança se constrói com transparência. No nosso aplicativo exclusivo você acompanha 24/7 quanto foi investido, em quê e qual retorno cada campanha gera. Sem espera.</p>
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
</section>

<!-- ===== BLOG (computador / janela do navegador) — após o formulário ===== -->
<section class="flow blogwide" id="blog-destaque">
  <span class="scene-edge"></span>
  <div class="wrap">
    <div class="shead">
      <span class="idx r up">04 — Do blog</span>
      <h2 class="r up">Quem entende,<br><span class="g">compartilha.</span></h2>
      <p class="sub r up d1">Estratégia, dados e bastidores de marketing — direto da nossa redação.</p>
    </div>

    <!-- janela do navegador -->
    <div class="blogwin r up d1" data-hover>
      <!-- chrome / barra do navegador -->
      <div class="blogwin-bar">
        <span class="bw-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="bw-addr">
          <svg class="bw-lock" width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V8a6 6 0 0 1 12 0v2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4" y="10" width="16" height="11" rx="2" fill="currentColor"/></svg>
          <span class="bw-addr-txt">blog.bamassessoria.com</span>
          <i class="bw-live" aria-hidden="true"></i>
        </span>
        <a class="bw-tabgo" href="${prefix}blog/index.html">Ver tudo →</a>
      </div>

      <!-- conteúdo da janela -->
      <div class="blogwin-body">
        <div class="cgrid" aria-hidden="true"></div>

        <!-- DESTAQUE = post mais novo -->
        <a class="bw-feature" href="${prefix}blog/instagram-seo-respondemos-as-perguntas-mais-frequentes-e-montamos-um-checklist-final.html" data-hover>
          <span class="bw-cover">
            <img src="${prefix}assets/img/blog/instagram-seo-respondemos-as-perguntas-mais-frequentes-e-montamos-um-checklist-final.webp" alt="Instagram + SEO: checklist final" loading="lazy" decoding="async">
            <span class="bw-badge">Destaque</span>
          </span>
          <span class="bw-fbody">
            <span class="bw-meta"><span class="pcat">Blog</span><span class="date">26 Ago 2025</span></span>
            <h3>Instagram + SEO: Perguntas Frequentes e Checklist Final</h3>
            <p>Encerrando a série sobre indexação do Instagram no Google: as dúvidas mais comuns e um checklist prático para ser encontrado pelos buscadores.</p>
            <span class="bw-go">Ler artigo <span class="ar">→</span></span>
          </span>
        </a>

        <!-- ÚLTIMAS = próximos posts mais recentes -->
        <div class="bw-list">
          <span class="bw-list-label">Últimas no blog</span>

          <a class="bw-row" href="${prefix}blog/seus-reels-no-google-o-guia-completo-para-criar-conteudo-que-o-algoritmo-ama-e-indexa.html" data-hover>
            <span class="bw-no">02</span>
            <span class="bw-rthumb"><img src="${prefix}assets/img/blog/seus-reels-no-google-o-guia-completo-para-criar-conteudo-que-o-algoritmo-ama-e-indexa.webp" alt="" loading="lazy" decoding="async"></span>
            <span class="bw-rtext"><span class="date">19 Ago 2025</span><h4>Seus Reels no Google: o guia completo do algoritmo</h4></span>
            <span class="bw-chev" aria-hidden="true">›</span>
          </a>

          <a class="bw-row" href="${prefix}blog/otimizacao-de-instagram-para-google-5-estrategias-de-seo-alem-das-hashtags.html" data-hover>
            <span class="bw-no">03</span>
            <span class="bw-rthumb"><img src="${prefix}assets/img/blog/otimizacao-de-instagram-para-google-5-estrategias-de-seo-alem-das-hashtags.webp" alt="" loading="lazy" decoding="async"></span>
            <span class="bw-rtext"><span class="date">12 Ago 2025</span><h4>Instagram para Google: 5 estratégias de SEO além das hashtags</h4></span>
            <span class="bw-chev" aria-hidden="true">›</span>
          </a>

          <a class="bw-row" href="${prefix}blog/a-indexacao-do-instagram-pelo-google-uma-nova-fronteira-para-a-visibilidade-online.html" data-hover>
            <span class="bw-no">04</span>
            <span class="bw-rthumb"><img src="${prefix}assets/img/blog/a-indexacao-do-instagram-pelo-google-uma-nova-fronteira-para-a-visibilidade-online.webp" alt="" loading="lazy" decoding="async"></span>
            <span class="bw-rtext"><span class="date">05 Ago 2025</span><h4>A indexação do Instagram pelo Google: nova fronteira</h4></span>
            <span class="bw-chev" aria-hidden="true">›</span>
          </a>

          <a class="bw-row" href="${prefix}blog/marketing-de-afiliados-o-que-e-e-como-implementar.html" data-hover>
            <span class="bw-no">05</span>
            <span class="bw-rthumb"><img src="${prefix}assets/img/blog/marketing-de-afiliados-o-que-e-e-como-implementar.webp" alt="" loading="lazy" decoding="async"></span>
            <span class="bw-rtext"><span class="date">24 Jun 2025</span><h4>Marketing de Afiliados: o que é e como implementar</h4></span>
            <span class="bw-chev" aria-hidden="true">›</span>
          </a>
        </div>
      </div>

      <!-- rodapé da janela -->
      <div class="blogwin-foot">
        <span class="bw-crumb">~/blog · novos artigos toda semana</span>
        <a class="btn" href="${prefix}blog/index.html" data-hover><span>Ler o blog</span> <span class="ar">→</span></a>
      </div>
    </div>
  </div>
</section>`;
  return page({
    prefix, bodyClass: 'home', title: SITE.name + ' | Inteligência de Crescimento Digital',
    desc: 'A BAM é a assessoria de marketing de performance que trata o seu marketing como investimento. Estratégia, tráfego pago, SEO, social e dados em tempo real.',
    path: '/', active: 'inicio', hasLoader: true, content,
    extraScripts: `<script src="${prefix}js/road-scrubber.js" defer></script>\n<script src="${prefix}js/deck.js" defer></script>\n`,
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
    <div class="fcta" style="margin-top:48px"><a href="contato.html" class="btn" data-hover><span>Falar com a BAM</span> <span class="ar">→</span></a></div>
  </div>
</section>`;
  return page({
    prefix, title: 'Sobre a BAM | Assessoria de Marketing de Performance',
    desc: 'Conheça a BAM: fundada em 2022 para democratizar o marketing de ponta. Missão, visão, valores e o time por trás da inteligência de crescimento.',
    path: '/sobre.html', active: 'sobre', content,
  });
}

function buildContato() {
  const prefix = '';
  const wa = `https://api.whatsapp.com/send/?phone=${SITE.whats}&text=${encodeURIComponent('Olá, quero falar com a BAM')}`;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'ContactPage',
    name: 'Contato — ' + SITE.name, url: SITE.url + '/contato.html',
    mainEntity: {
      '@type': 'Organization', name: SITE.name, url: SITE.url + '/',
      email: SITE.email, telephone: SITE.tel,
      address: { '@type': 'PostalAddress', streetAddress: 'Rua Aviador Gil Guilherme 38, Bloco 2', addressLocality: 'São Paulo', addressRegion: 'SP', addressCountry: 'BR' },
      contactPoint: { '@type': 'ContactPoint', telephone: SITE.tel, email: SITE.email, contactType: 'sales', areaServed: 'BR', availableLanguage: 'Portuguese' },
      sameAs: [SITE.instagram, SITE.linkedin, SITE.facebook],
    },
  });
  const content = `<header class="page-head">
  <div class="hero-grid" data-par="0.1"></div>
  <div class="hero-glow"></div>
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Você está em"><a href="index.html">Início</a><span class="sep">/</span><span>Contato</span></nav>
    <h1 class="r up in">Vamos crescer<br><span class="g">juntos?</span></h1>
    <p class="lead r up in d1">Conte sobre o momento do seu negócio e receba um diagnóstico estratégico gratuito. Escolha o canal que preferir — respondemos rápido, com foco em resultado e retorno sobre investimento.</p>
  </div>
</header>

<!-- CANAIS DIRETOS -->
<section class="section">
  <div class="wrap">
    <div class="shead"><span class="idx r up">01 — Canais diretos</span><h2 class="r up">Fale com a BAM<br>do seu <span class="g">jeito.</span></h2></div>
    <div class="channels">
      <a class="channel r up d1" href="${wa}" target="_blank" rel="noopener noreferrer" data-hover><span class="cnum">01 — WhatsApp</span><h3>WhatsApp</h3><p>O canal mais rápido. Fale agora com o time comercial.</p><span class="val">Abrir conversa <span class="ar">→</span></span></a>
      <a class="channel r up d2" href="mailto:${SITE.email}" data-hover><span class="cnum">02 — E-mail</span><h3>E-mail</h3><p>Para propostas, parcerias e assuntos comerciais.</p><span class="val">${SITE.email} <span class="ar">→</span></span></a>
      <a class="channel r up d3" href="tel:${SITE.tel}" data-hover><span class="cnum">03 — Telefone</span><h3>Telefone</h3><p>Prefere ligar? Estamos no horário comercial.</p><span class="val">${SITE.telDisplay} <span class="ar">→</span></span></a>
    </div>
  </div>
</section>

<!-- FORMULÁRIO + INFORMAÇÕES -->
<section class="section alt" id="form">
  <div class="wrap">
    <div class="shead"><span class="idx r up">02 — Diagnóstico gratuito</span><h2 class="r up">Conte o seu <span class="g">momento.</span></h2><p class="sub r up d1">Sem compromisso. Nosso time prepara uma leitura estratégica do seu negócio antes mesmo da primeira conversa.</p></div>
    <div class="cwrap">
      <div class="ccopy r left d1">
        <span class="tlabel">Fale com um especialista</span>
        <p>Preencha o formulário e enviaremos seu contato direto ao nosso WhatsApp comercial com os dados já preenchidos.</p>
        <div class="pts"><div>Diagnóstico estratégico gratuito</div><div>Plano de crescimento sob medida</div><div>Acompanhamento em tempo real pelo app</div></div>
        <div class="contact-info">
          <div class="ci"><span class="lab">Atendimento</span><span>Seg a Sex · 9h às 18h (horário de Brasília)</span></div>
          <div class="ci"><span class="lab">E-mail</span><a href="mailto:${SITE.email}">${SITE.email}</a></div>
          <div class="ci"><span class="lab">Telefone / WhatsApp</span><a href="tel:${SITE.tel}">${SITE.telDisplay}</a></div>
          <div class="ci"><span class="lab">Endereço</span><span>${SITE.addr}</span></div>
          <div class="ci"><span class="lab">Redes sociais</span><div class="contact-socials"><a href="${SITE.instagram}" target="_blank" rel="noopener noreferrer">Instagram</a><a href="${SITE.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a><a href="${SITE.facebook}" target="_blank" rel="noopener noreferrer">Facebook</a></div></div>
        </div>
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
</section>

<!-- TRANSPARÊNCIA / APP -->
<section class="section">
  <div class="wrap">
    <div class="feature r scale">
      <span class="tlabel">App exclusivo · em tempo real</span>
      <h2>Transparência <span class="g">total.</span></h2>
      <p>Ao se tornar cliente, você acompanha 24/7 quanto foi investido, em quê e qual retorno cada campanha gera — direto no nosso aplicativo exclusivo. Sem relatórios complicados, sem espera.</p>
      <div class="chips"><span>Investimento ao vivo</span><span>Retorno por campanha</span><span>Sem relatório confuso</span><span>24/7</span></div>
    </div>
  </div>
</section>`;
  return page({
    prefix, title: 'Contato | ' + SITE.name,
    desc: 'Fale com a BAM Assessoria: WhatsApp, e-mail, telefone e formulário para um diagnóstico estratégico gratuito do seu negócio. São Paulo / BR.',
    path: '/contato.html', active: 'contato', jsonLd, content,
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
      <p><strong>Última atualização:</strong> agosto de 2026.</p>
      <p>A sua privacidade é importante para a <strong>BAM Assessoria em Marketing</strong> ("BAM", "nós"). Esta política explica quais dados pessoais tratamos, com qual finalidade e quais são os seus direitos. Ao utilizar este site e nossos canais de contato, você concorda com as práticas aqui descritas.</p>

      <h2>1. Quem é o controlador</h2>
      <p>O controlador dos dados é a BAM Assessoria em Marketing, situada na ${esc(SITE.addr)}. Para qualquer assunto relativo a dados pessoais, fale conosco pelo e-mail <a href="mailto:${SITE.email}">${SITE.email}</a>.</p>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li><strong>Dados que você nos fornece:</strong> nome, e-mail, telefone, empresa/segmento e a mensagem enviada pelo formulário de contato ou pela newsletter. Esses dados são enviados diretamente ao nosso WhatsApp comercial quando você submete o formulário.</li>
        <li><strong>Dados de materiais gratuitos:</strong> ao baixar um e-book ou guia em nossas páginas de material rico, registramos nome, e-mail, telefone, empresa (opcional), a origem do acesso e o material solicitado. Esse registro só acontece mediante o seu consentimento explícito, marcado no próprio formulário, e fica armazenado no Cloud Firestore (Google), acessível apenas à equipe autorizada da BAM.</li>
        <li><strong>Dados de navegação:</strong> utilizamos o <strong>Google Analytics 4</strong> para entender de forma agregada quais conteúdos são acessados e como o site é utilizado. Esses cookies <strong>só são gravados após o seu aceite</strong> no aviso exibido na primeira visita — se você recusar, nenhum cookie de medição é criado. Sua escolha pode ser alterada a qualquer momento pelo link <strong>&ldquo;Cookies&rdquo;</strong> no rodapé. Coletamos o IP de forma anonimizada e não utilizamos os dados para publicidade ou remarketing.</li>
        <li><strong>Recursos de terceiros:</strong> serviços externos carregados pelo site (fontes do Google Fonts, o serviço de proteção reCAPTCHA do Google, que protege nossos formulários contra envios automatizados, e nossa ferramenta de análise de sessão) podem registrar seu endereço IP ao carregar os arquivos, conforme as políticas do respectivo provedor.</li>
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

      <h2>5. Cookies e sua escolha</h2>
      <p>Cookies são pequenos arquivos gravados no seu navegador. Usamos apenas duas categorias:</p>
      <ul>
        <li><strong>Essenciais:</strong> guardam a sua própria decisão sobre cookies, para que o aviso não reapareça a cada visita. Não identificam você e não podem ser desativados, já que sem eles a escolha não seria respeitada.</li>
        <li><strong>De medição (Google Analytics 4):</strong> mostram, de forma agregada, quantas pessoas acessam cada página e por quais caminhos chegam. <strong>Só são gravados se você aceitar.</strong> Enquanto não houver aceite, o Google Analytics permanece desativado por meio do Consent Mode e nenhum identificador é criado.</li>
      </ul>
      <p>Você pode aceitar ou recusar no aviso da primeira visita e <strong>rever a decisão quando quiser</strong> pelo link <strong>&ldquo;Cookies&rdquo;</strong> no rodapé de qualquer página. Recusar não limita nenhuma funcionalidade do site.</p>

      <h2>6. Compartilhamento</h2>
      <p>Não vendemos seus dados. Podemos compartilhá-los com operadores que nos apoiam na prestação do serviço (por exemplo, a plataforma de mensagens WhatsApp/Meta, e o Google, como provedor do Firebase e do Google Analytics), sempre limitados à finalidade informada. Esses terceiros possuem políticas de privacidade próprias.</p>

      <h2>7. Seus direitos</h2>
      <p>Conforme a LGPD, você pode a qualquer momento solicitar: confirmação da existência de tratamento; acesso aos dados; correção de dados incompletos ou desatualizados; anonimização ou eliminação; portabilidade; e revogação do consentimento. Para exercer seus direitos, escreva para <a href="mailto:${SITE.email}">${SITE.email}</a>.</p>

      <h2>8. Retenção e segurança</h2>
      <p>Mantemos os dados apenas pelo tempo necessário às finalidades descritas ou conforme exigido por lei. Adotamos medidas técnicas e organizacionais razoáveis para proteger seus dados contra acesso não autorizado, perda ou alteração.</p>

      <h2>9. Alterações desta política</h2>
      <p>Podemos atualizar esta política periodicamente. A versão vigente estará sempre disponível nesta página, com a data da última atualização.</p>

      <h2>10. Contato</h2>
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
      <span class="blog-count" id="blogCount" data-static="${posts.length}">${posts.length} artigos</span>
    </div>
    <div class="posts" id="postsGrid">
      ${cards}
    </div>
    <p class="no-results" id="noResults">Nenhum artigo encontrado.</p>
  </div>
</section>`;
  return page({
    prefix, title: 'Blog | BAM Assessoria em Marketing',
    desc: 'Artigos e insights de marketing de performance, tráfego pago, SEO, branding e estratégia pela BAM Assessoria.',
    path: '/blog/index.html', active: 'blog', content, firebase: true,
    extraScripts: `<script type="module" src="${prefix}js/blog-feed.js"></script>\n`,
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
    <div class="article-head">
      <div class="pmeta">${cat}<span class="dim">${fmtDate(p.date)} · ${readingTime(p.bodyHtml)} min de leitura</span></div>
      <h1>${esc(p.title)}</h1>
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
      <a href="${prefix}contato.html" class="btn" data-hover><span>Falar com a BAM</span> <span class="ar">→</span></a>
    </div>
  </div>
</article>`;
  return page({
    prefix, title: p.title + ' | Blog BAM Assessoria',
    desc: p.excerpt || ('Artigo do blog da BAM Assessoria: ' + p.title),
    path: '/blog/' + p.slug + '.html', active: 'blog', ogType: 'article', jsonLd, content, portfolio: false,
  });
}

/* ---------- Visualizador de posts dinâmicos (Firestore) ----------
   Renderiza, no cliente, um post criado pela página /admin. A leitura é por
   ?slug=... na URL. Mantém o mesmo layout dos artigos estáticos. */
function buildPostViewer() {
  const prefix = '../';
  const content = `<header class="page-head">
  <div class="hero-grid"></div>
  <div class="hero-glow"></div>
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Você está em"><a href="${prefix}index.html">Início</a><span class="sep">/</span><a href="${prefix}blog/index.html">Blog</a><span class="sep">/</span><span>Artigo</span></nav>
    <div class="article-head">
      <div class="pmeta" id="postMeta"></div>
      <h1 id="postTitle">Carregando artigo…</h1>
    </div>
  </div>
</header>

<article class="section">
  <div class="wrap">
    <div class="article">
      <div class="article-cover" id="postCover" hidden><img id="postCoverImg" alt="" width="1200" height="675" decoding="async"></div>
      <div class="prose" id="postBody"><p style="color:var(--gray)">Carregando conteúdo…</p></div>
    </div>
    <div class="article-foot">
      <a class="back" href="${prefix}blog/index.html"><span aria-hidden="true">←</span> Voltar ao blog</a>
    </div>
    <div class="article-cta article">
      <h3>Quer resultados como esses no seu <span class="g">negócio?</span></h3>
      <p>Receba um diagnóstico estratégico gratuito e descubra como tratar o seu marketing como investimento.</p>
      <a href="${prefix}contato.html" class="btn" data-hover><span>Falar com a BAM</span> <span class="ar">→</span></a>
    </div>
  </div>
</article>`;
  return page({
    prefix, title: 'Artigo | Blog BAM Assessoria',
    desc: 'Artigo do blog da BAM Assessoria em Marketing.',
    path: '/blog/post.html', active: 'blog', ogType: 'article',
    firebase: true, noindex: true, content, portfolio: false,
    extraScripts: `<script type="module" src="${prefix}js/post-view.js"></script>\n`,
  });
}

/* ---------- Landing page de material rico (/materiais/<slug>/) ----------
   Página de conversão: gerada com `chrome:false` (sem menu, rodapé completo
   nem botão flutuante do WhatsApp) porque cada link a mais é uma rota de
   fuga do formulário. O post do blog é quem traz tráfego; esta página só
   converte. Precisa de `firebase:true` — a CSP tem que liberar gstatic e
   firestore.googleapis.com para o `addDoc` de js/lp-ebook.js funcionar. */
function buildLpEbook() {
  const prefix = '../../';
  const book = J('data/ebook-smarketing.json');
  if (!book) return null;

  const dir = 'materiais/' + book.slug;
  const path = '/' + dir + '/';
  const pdf = prefix + book.pdf;
  const capa = prefix + 'assets/img/ebooks/smarketing-capa.webp';
  const wa = `https://api.whatsapp.com/send/?phone=${SITE.whats}&text=${encodeURIComponent('Olá! Baixei o guia Smarketing na Prática e quero falar com a BAM.')}`;

  // Um cartão por capítulo, com a promessa concreta de cada um.
  const CHAPS = [
    ['01', 'O abismo entre marketing e comercial', 'Os cinco sintomas de uma operação desalinhada e onde o custo desse atrito aparece — mesmo sem linha no relatório.'],
    ['02', 'ICP e critérios de qualificação', 'Como escrever a definição de MQL e SQL que as duas áreas assinam embaixo, e quais filtros elevam a qualidade sem matar o volume.'],
    ['03', 'O SLA interno', 'Modelo de acordo pronto: volume de MQLs, tempo até o primeiro contato, tentativas mínimas e motivos de perda padronizados.'],
    ['04', 'Integração e feedback loop', 'O CRM como fonte única da verdade, a pauta da reunião semanal e o fluxo de nutrição para quem não fechou agora.'],
    ['05', 'Abordagem orientada a contexto', 'A matriz de objeções x conteúdo: qual material responde a qual objeção, e em que momento da negociação usar.'],
    ['06', 'Checklist para esta semana', 'Oito passos aplicáveis sem ferramenta nova e sem reestruturar o time — para sair do diagnóstico e começar.'],
  ];

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebPage',
    name: book.title + ' — guia gratuito', url: SITE.url + path,
    description: book.subtitle, inLanguage: 'pt-BR',
    isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url + '/' },
    primaryImageOfPage: { '@type': 'ImageObject', url: SITE.url + '/assets/img/ebooks/smarketing-capa.webp' },
    about: { '@type': 'Thing', name: 'Alinhamento entre marketing e vendas (Smarketing) em operações B2B' },
    publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url + '/' },
  });

  const content = `<div class="lp-bar">
  <a class="lp-logo" href="${prefix}index.html" data-hover>
    <img src="${ICON(prefix)}" alt="${escAttr(SITE.name)}" width="30" height="30">
    <b>${esc(SITE.name)}</b>
  </a>
  <a class="lp-back" href="${prefix}index.html">Ir para o site &rarr;</a>
</div>

<!-- HERO + FORMULÁRIO -->
<section class="lp-hero">
  <div class="hero-grid"></div>
  <div class="hero-glow"></div>
  <div class="lp-wrap">
    <div class="lp-grid">

      <div>
        <span class="lp-kick r up in">Guia gratuito &middot; B2B</span>
        <h1 class="r up in d1">Marketing entrega.<br>Vendas reclama.<br><span class="g">E a meta não fecha.</span></h1>
        <p class="lp-sub r up in d2">É o retrato mais comum das operações B2B que crescem rápido: uma área medida por
        volume de leads, outra por receita fechada — e dois times remando em direções distintas dentro da mesma empresa.
        <strong>${esc(book.title)}</strong> mostra como transformar isso em um único funil de receita, com critérios,
        acordos e rotinas prontos para adaptar ao seu tamanho.</p>

        <ul class="lp-gets r up in d3">
          <li>Critérios objetivos de MQL e SQL para encerrar a discussão sobre &ldquo;lead ruim&rdquo;</li>
          <li>Modelo pronto de SLA entre marketing e comercial, com metas por área</li>
          <li>Matriz de objeções x conteúdo para acelerar o fechamento</li>
          <li>Checklist de 8 passos para aplicar já nesta semana</li>
        </ul>

        <div class="lp-trust r up d4">
          <div><b>15</b> páginas</div>
          <div><b>5</b> capítulos + checklist</div>
          <div><b>PDF</b> download imediato</div>
        </div>
      </div>

      <div class="lp-card r right d1" id="form">
        <div id="lpCardHead">
          <img class="lp-cover" src="${capa}" alt="Capa do guia ${escAttr(book.title)}" width="118" height="167" decoding="async">
          <h2>Receba o guia<br>agora</h2>
          <p class="lp-cardsub">PDF &middot; 15 páginas &middot; Gratuito</p>
        </div>

        <form id="lpForm" data-material="${escAttr(book.slug)}" aria-label="Formulário para receber o guia">
          <div class="field"><label for="lpNome">Nome completo*</label>
            <input id="lpNome" type="text" name="nome" required maxlength="80" placeholder="Seu nome" autocomplete="name"></div>
          <div class="field"><label for="lpEmail">E-mail corporativo*</label>
            <input id="lpEmail" type="email" name="email" required maxlength="120" placeholder="voce@empresa.com" autocomplete="email"></div>
          <div class="field"><label for="lpTelefone">WhatsApp*</label>
            <input id="lpTelefone" type="tel" name="telefone" required maxlength="20" placeholder="(11) 9 0000-0000" autocomplete="tel"></div>
          <div class="field"><label for="lpEmpresa">Empresa</label>
            <input id="lpEmpresa" type="text" name="empresa" maxlength="80" placeholder="Nome da empresa" autocomplete="organization"></div>

          <div class="lp-hp" aria-hidden="true">
            <label for="lpSite">Não preencha este campo</label>
            <input id="lpSite" type="text" name="site" tabindex="-1" autocomplete="off">
          </div>

          <div class="lp-consent">
            <input id="lpConsent" type="checkbox" required>
            <label for="lpConsent">Autorizo a BAM Assessoria a usar meus dados para enviar este material e
            entrar em contato sobre seus serviços. Posso pedir a exclusão a qualquer momento.
            <a href="${prefix}privacidade.html" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.</label>
          </div>

          <button type="submit" class="btn" data-hover><span>Quero o guia</span> <span class="ar">&rarr;</span></button>
          <p class="form-note">Sem spam. Você recebe o material na hora, nesta mesma tela.</p>
        </form>

        <div class="lp-err" id="lpErr" role="alert"></div>

        <div class="lp-done" id="lpDone" role="status">
          <div class="lp-check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5.5 5.5L20 7"/></svg></div>
          <h2>Pronto!</h2>
          <p>Seu guia está liberado. O arquivo abre no computador e no celular.</p>
          <a class="btn" id="lpDownload" href="${pdf}" download data-hover><span>Baixar o PDF</span> <span class="ar">&darr;</span></a>
          <a class="lp-alt" href="${wa}" target="_blank" rel="noopener noreferrer">Prefere conversar? Chamar no WhatsApp &rarr;</a>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- O QUE TEM DENTRO -->
<section class="section">
  <div class="wrap">
    <div class="shead"><span class="idx r up">01 &mdash; O que tem dentro</span><h2 class="r up">Seis blocos, todos <span class="g">aplicáveis.</span></h2><p class="sub r up d1">Nada de teoria solta: cada capítulo termina em um critério, um modelo de acordo ou uma rotina que dá para levar para a próxima reunião.</p></div>
    <div class="lp-chapters">
      ${CHAPS.map(([n, t, d], i) => `<article class="lp-chap r up d${(i % 3) + 1}"><span class="n">${n}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join('\n      ')}
    </div>
  </div>
</section>

<!-- PARA QUEM É -->
<section class="section alt">
  <div class="wrap">
    <div class="shead"><span class="idx r up">02 &mdash; Antes de baixar</span><h2 class="r up">Esse guia é para <span class="g">você?</span></h2></div>
    <div class="lp-fit">
      <div class="yes r left d1">
        <h3>Faz sentido se</h3>
        <ul>
          <li>Sua empresa vende B2B e tem time comercial, mesmo que pequeno.</li>
          <li>O comercial reclama da qualidade dos leads e o marketing do aproveitamento.</li>
          <li>Ninguém sabe dizer, com número, quantos leads viram oportunidade real.</li>
          <li>Você quer formalizar o que hoje só existe de forma informal.</li>
        </ul>
      </div>
      <div class="no r right d2">
        <h3>Talvez não seja a hora se</h3>
        <ul>
          <li>Você ainda não tem geração de demanda rodando de forma constante.</li>
          <li>Sua operação é 100% B2C, com ticket baixo e venda sem consultor.</li>
          <li>Você procura táticas de anúncio, e não estrutura de processo comercial.</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- CHAMADA FINAL -->
<section class="lp-final">
  <div class="lp-wrap">
    <h2 class="r up">Leva 30 segundos<br>para <span class="g">começar.</span></h2>
    <p class="r up d1">Preencha o formulário e o PDF é liberado na hora, sem confirmação por e-mail e sem espera.</p>
    <a href="#form" class="btn r up d2" data-hover><span>Receber o guia</span> <span class="ar">&uarr;</span></a>
  </div>
</section>

<div class="lp-foot">
  <p>&copy; ${new Date().getFullYear()} ${esc(SITE.name)} &middot; Material gratuito</p>
  <div class="lp-fl">
    <a href="${prefix}privacidade.html">Política de Privacidade</a>
    <a href="#" data-cookies>Cookies</a>
    <a href="${prefix}index.html">Site da BAM</a>
    <a href="${prefix}blog/index.html">Blog</a>
  </div>
</div>`;

  const html = page({
    prefix, bodyClass: 'lp', title: book.title + ' — guia gratuito | ' + SITE.name,
    desc: `Guia gratuito em PDF: como unir marketing e comercial em um único funil de receita B2B — critérios de MQL e SQL, modelo de SLA, matriz de objeções e checklist para aplicar nesta semana.`,
    path, active: null, jsonLd, ogType: 'article', content,
    firebase: true, chrome: false,
    extraScripts: `<script type="module" src="${prefix}js/lp-ebook.js"></script>\n`,
  });

  mkdirSync(dir, { recursive: true });
  writeFileSync(dir + '/index.html', html);
  return path;
}

/* ===================== runner ===================== */
mkdirSync('blog', { recursive: true });
writeFileSync('index.html', buildHome());
writeFileSync('sobre.html', buildSobre());
writeFileSync('contato.html', buildContato());
writeFileSync('privacidade.html', buildPrivacidade());
writeFileSync('blog/post.html', buildPostViewer()); // visualizador de posts dinâmicos
let n = 5;
const lpEbook = buildLpEbook(); // landing page do material rico (se houver o JSON)
if (lpEbook) n++;
if (injectPortfolio()) n++; // galeria de portifolio.html (blocos entre marcadores)
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
// Datas de lastmod fixas (última revisão real de cada página). Portfólio e as
// páginas de serviços não são geradas por este build, mas são incluídas no
// sitemap para não regredir o que já está no ar.
const REV = '2026-06-16';
const urls = [
  { loc: '/', lastmod: REV, prio: '1.0' },
  { loc: '/sobre.html', lastmod: REV, prio: '0.8' },
  { loc: '/contato.html', lastmod: REV, prio: '0.8' },
  { loc: '/portifolio.html', lastmod: '2026-06-17', prio: '0.9' },
  { loc: '/privacidade.html', lastmod: REV, prio: '0.3' },
];
if (posts.length) {
  urls.push({ loc: '/blog/index.html', lastmod: REV, prio: '0.7' });
  posts.forEach(p => urls.push({ loc: '/blog/' + p.slug + '.html', lastmod: p.date || REV, prio: '0.6' }));
}
['trafego-pago', 'landing-pages', 'seo', 'design-identidade', 'redes-sociais', 'campanhas-sob-medida']
  .forEach(s => urls.push({ loc: '/servicos/' + s + '.html', lastmod: '2026-06-24', prio: '0.8' }));
if (lpEbook) urls.push({ loc: lpEbook, lastmod: '2026-08-18', prio: '0.9' });
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE.url}${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.prio}</priority></url>`).join('\n')}
</urlset>
`;
writeFileSync('sitemap.xml', sitemap);
writeFileSync('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);

console.log(`Gerado: ${n} páginas (${posts.length} posts de blog) + sitemap.xml + robots.txt.`);
console.log(`Equipe: ${team.length} | Clientes: ${clients.length} | Portfólio: ${works.length} peças (${deckWorks.length} no deck da home)`);
