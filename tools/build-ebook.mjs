/* =============================================================
   BAM Assessoria — Gerador do PDF do ebook
   -------------------------------------------------------------
   Lê  data/ebook-smarketing.json  (fonte da verdade do conteúdo),
   monta um HTML diagramado com a identidade da BAM e imprime em
   PDF via Chrome headless (protocolo CDP, sem nenhuma dependência
   de npm).

   Uso:  node tools/build-ebook.mjs
   Saída: assets/ebooks/smarketing-na-pratica.pdf
          tools/.ebook-preview.html   (para conferir no navegador)

   A paginação é feita por JS dentro da própria página: os blocos
   são distribuídos em folhas A4 de altura fixa, o que garante
   sumário com números de página corretos e rodapé em toda folha.
   ============================================================= */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BOOK = JSON.parse(readFileSync('data/ebook-smarketing.json', 'utf8'));
const OUT_PDF = 'assets/ebooks/smarketing-na-pratica.pdf';
const OUT_COVER = 'assets/img/ebooks/smarketing-capa.webp';
// capa 16:9 do post do blog que serve de isca para a landing page
const OUT_CARD = 'assets/img/blog/smarketing-como-alinhar-marketing-e-vendas-no-b2b.webp';
const PREVIEW = 'tools/.ebook-preview.html';
const PORT = 9333;

const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// O conteúdo do JSON é redigido pela própria BAM e usa <em>/<strong>/<br> de propósito.
const rich = (s) => String(s);

/* ---------- marca ---------- */
const CHEVRONS = `<svg class="mark" viewBox="120 254 672 398" aria-hidden="true">
  <polygon points="128.7 262 273.4 262 413.4 452.8 273.4 643.5 128.7 643.5 268.7 452.8 128.7 262"/>
  <polygon points="313.7 262 458.3 262 598.3 452.8 458.3 643.5 313.7 643.5 453.7 452.8 313.7 262"/>
  <polygon points="498.6 262 643.3 262 783.3 452.8 643.3 643.5 498.6 643.5 638.6 452.8 498.6 262"/>
  <circle cx="738.3" cy="598.6" r="45"/>
</svg>`;

const WORDMARK = readFileSync('assets/svg/logo-wordmark.svg', 'utf8')
  .replace(/^[\s\S]*?<svg /, '<svg class="wordmark" ')
  .replace(/<\?xml[\s\S]*?\?>/, '');

/* ---------- blocos → HTML ---------- */
function block(b) {
  switch (b.type) {
    case 'lead':
      return `<p class="lead" data-flow>${rich(b.text)}</p>`;
    case 'p':
      return `<p data-flow data-split>${rich(b.text)}</p>`;
    case 'h2':
      return `<h2 data-flow data-keep-next>${esc(b.text)}</h2>`;
    case 'list':
      return `<ul data-flow data-items>${b.items.map((i) => `<li>${rich(i)}</li>`).join('')}</ul>`;
    case 'checklist':
      return `<ol class="checklist" data-flow data-items>${b.items
        .map((i) => `<li><span class="cbox"></span><span>${rich(i)}</span></li>`)
        .join('')}</ol>`;
    case 'deflist':
      return `<dl data-flow data-items>${b.items
        .map((i) => `<div class="dfi"><dt>${esc(i.term)}</dt><dd>${rich(i.desc)}</dd></div>`)
        .join('')}</dl>`;
    case 'callout':
      return `<aside class="callout" data-flow><h4>${esc(b.title)}</h4><p>${rich(b.text)}</p></aside>`;
    case 'table':
      return `<div class="tbl" data-flow data-items data-table><table>
  <thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
  <tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${rich(c)}</td>`).join('')}</tr>`).join('')}</tbody>
</table></div>`;
    default:
      return '';
  }
}

function chapterHtml(ch) {
  const opener = `<header class="chap-open" data-flow data-break data-chap="${ch.id}">
  ${ch.num ? `<span class="chap-num">${ch.num}</span>` : '<span class="chap-num chap-num--none"></span>'}
  <h1>${esc(ch.title)}</h1>
  <span class="chap-rule"></span>
</header>`;
  return opener + ch.blocks.map(block).join('\n');
}

/* ---------- documento ---------- */
const FLOW = BOOK.chapters.map(chapterHtml).join('\n');

const TOC_ROWS = BOOK.chapters
  .map(
    (c) => `<li data-toc="${c.id}">
  <span class="toc-num">${c.num || '—'}</span>
  <span class="toc-title">${esc(c.title)}</span>
  <span class="toc-dots"></span>
  <span class="toc-page">·</span>
</li>`
  )
  .join('');

const CSS = `
@page { size: A4; margin: 0; }
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  font-family:'Inter','Trebuchet MS',sans-serif;
  color:#222724; background:#fff;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
  font-size:10.6pt; line-height:1.62;
}
:root{
  --green:#00FFAE; --green3:#57F5C3; --dgreen:#0F5741; --deep:#08211A;
  --black:#050505; --ink:#222724; --soft:#5d6763; --hair:#e2e8e5;
}

/* ---------- folha ---------- */
.page{
  width:210mm; height:297mm; position:relative; overflow:hidden;
  background:#fff; break-after:page; page-break-after:always;
}
.page:last-child{break-after:auto;page-break-after:avoid}
.page-body{position:absolute;left:24mm;right:20mm;top:22mm;bottom:20mm;overflow:hidden}

/* rodapé corrente */
.pfoot{position:absolute;left:24mm;right:20mm;bottom:11mm;display:flex;
  justify-content:space-between;align-items:center;
  font-family:'Space Mono',monospace;font-size:7pt;letter-spacing:.08em;
  text-transform:uppercase;color:#9aa5a1;border-top:1px solid var(--hair);padding-top:3mm}
.pfoot .pf-n{color:var(--dgreen);font-weight:700}

/* barra lateral verde discreta */
.page-edge{position:absolute;left:0;top:0;bottom:0;width:6mm;background:var(--deep)}
.page-edge::after{content:"";position:absolute;left:0;top:0;width:100%;height:38mm;background:var(--green3)}

/* ---------- capa ---------- */
.cover{background:var(--black);color:#fff;overflow:hidden}
.cover .glow{position:absolute;width:150mm;height:150mm;right:-45mm;top:-40mm;border-radius:50%;
  background:radial-gradient(circle,rgba(0,255,174,.20) 0%,rgba(0,255,174,0) 68%)}
.cover .glow2{position:absolute;width:120mm;height:120mm;left:-50mm;bottom:-45mm;border-radius:50%;
  background:radial-gradient(circle,rgba(0,255,174,.13) 0%,rgba(0,255,174,0) 70%)}
.cover .grid{position:absolute;inset:0;opacity:.14;
  background-image:linear-gradient(rgba(87,245,195,.30) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(87,245,195,.30) 1px,transparent 1px);
  background-size:14mm 14mm}
.cover-in{position:absolute;left:24mm;right:24mm;top:26mm;bottom:22mm;display:flex;flex-direction:column}
.mark{width:34mm;fill:var(--green3);display:block}
.cover .kicker{font-family:'Space Mono',monospace;font-size:8.5pt;letter-spacing:.30em;
  text-transform:uppercase;color:var(--green);margin:14mm 0 0}
.cover h1{font-family:'Oswald',sans-serif;font-weight:600;font-size:58pt;line-height:1.03;
  letter-spacing:-.015em;text-transform:uppercase;margin:5mm 0 0;color:#fff}
.cover h1 em{font-style:normal;color:var(--green)}
.cover .sub{font-size:13pt;line-height:1.45;color:#c8d2ce;margin:9mm 0 0;max-width:118mm;font-weight:300}
.cover .rule{height:2px;width:38mm;background:var(--green);margin:11mm 0 0}
.cover-list{list-style:none;margin:14mm 0 0;padding:0;max-width:120mm}
.cover-list li{position:relative;padding-left:8mm;margin-bottom:4.2mm;color:#dfeae6;
  font-size:10.4pt;line-height:1.35}
.cover-list li::before{content:"";position:absolute;left:0;top:1.2mm;width:3.4mm;height:3.4mm;
  background:var(--green);clip-path:polygon(0 0,52% 0,100% 50%,52% 100%,0 100%,48% 50%)}
.cover .meta{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;
  border-top:1px solid rgba(255,255,255,.14);padding-top:7mm}
.cover .wordmark{width:52mm;height:auto}
.cover .wordmark .cls-3{fill:#fff}
.cover .meta .date{font-family:'Space Mono',monospace;font-size:8pt;letter-spacing:.14em;
  text-transform:uppercase;color:#8d9a95;text-align:right;line-height:1.9}
.cover .meta .date b{color:var(--green3);font-weight:400;display:block}

/* ---------- sumário ---------- */
.toc-page-sheet .page-body{top:26mm}
.toc-h{font-family:'Oswald',sans-serif;font-weight:600;font-size:30pt;text-transform:uppercase;
  letter-spacing:-.01em;margin:0;color:var(--black)}
.toc-kick{font-family:'Space Mono',monospace;font-size:7.5pt;letter-spacing:.28em;
  text-transform:uppercase;color:var(--dgreen);margin:0 0 3mm}
.toc-rule{height:2px;width:26mm;background:var(--green);margin:6mm 0 12mm}
ol.toc{list-style:none;margin:0;padding:0}
ol.toc li{display:flex;align-items:baseline;gap:3mm;padding:4.4mm 0;border-bottom:1px solid var(--hair)}
.toc-num{font-family:'Space Mono',monospace;font-size:8.5pt;color:var(--green3);
  background:var(--deep);border-radius:3px;padding:1.4mm 2.2mm;min-width:11mm;text-align:center;font-weight:700}
.toc-title{font-family:'Oswald',sans-serif;font-weight:500;font-size:13pt;text-transform:uppercase;
  letter-spacing:.005em;color:var(--ink)}
.toc-dots{flex:1;border-bottom:1.4px dotted #c9d3cf;transform:translateY(-2px)}
.toc-page{font-family:'Space Mono',monospace;font-size:10pt;font-weight:700;color:var(--dgreen);min-width:8mm;text-align:right}
.toc-note{margin-top:14mm;padding:6mm 7mm;background:#f2f7f5;border-left:3px solid var(--green);
  font-size:9.4pt;color:#4a5551;line-height:1.6}
.toc-note b{color:var(--ink)}

/* ---------- abertura de capítulo ---------- */
.chap-open{margin:0 0 9mm}
.chap-num{font-family:'Oswald',sans-serif;font-weight:700;font-size:44pt;line-height:1;
  display:block;color:transparent;-webkit-text-stroke:1.4px var(--green3);letter-spacing:.02em}
.chap-num--none{display:none}
.chap-open h1{font-family:'Oswald',sans-serif;font-weight:600;font-size:23pt;line-height:1.12;
  text-transform:uppercase;letter-spacing:-.005em;color:var(--black);margin:2mm 0 0;max-width:132mm}
.chap-rule{display:block;height:2px;width:22mm;background:var(--green);margin:5mm 0 0}

/* ---------- corpo ---------- */
h2{font-family:'Oswald',sans-serif;font-weight:500;font-size:13.5pt;text-transform:uppercase;
  letter-spacing:.01em;color:var(--dgreen);margin:8mm 0 3mm;display:flex;align-items:center;gap:2.6mm}
h2::before{content:"";width:3.4mm;height:3.4mm;background:var(--green);flex:0 0 auto;
  clip-path:polygon(0 0,52% 0,100% 50%,52% 100%,0 100%,48% 50%)}
p{margin:0 0 3.6mm;text-align:justify;hyphens:auto}
p.lead{font-size:12.6pt;line-height:1.5;color:var(--black);font-weight:500;text-align:left;
  border-left:3px solid var(--green);padding-left:5mm;margin-bottom:5mm}
em{font-style:italic;color:var(--dgreen);font-weight:500}
strong{font-weight:600;color:var(--black)}

ul{margin:0 0 4mm;padding:0;list-style:none}
ul li{position:relative;padding-left:6mm;margin-bottom:2.4mm}
ul li::before{content:"";position:absolute;left:0;top:2.1mm;width:2.8mm;height:2.8mm;background:var(--green3);
  clip-path:polygon(0 0,52% 0,100% 50%,52% 100%,0 100%,48% 50%)}

dl{margin:0 0 4mm}
.dfi{padding:3mm 0 3mm 5mm;border-left:2px solid var(--hair);margin-bottom:2.2mm}
.dfi dt{font-weight:600;color:var(--black);font-size:10.4pt;margin-bottom:.8mm}
.dfi dd{margin:0;color:#414b47}

ol.checklist{list-style:none;margin:0 0 4mm;padding:0;counter-reset:ck}
ol.checklist li{display:flex;gap:3.4mm;align-items:flex-start;padding:2.6mm 0;border-bottom:1px dashed var(--hair)}
ol.checklist .cbox{flex:0 0 auto;width:4.2mm;height:4.2mm;border:1.6px solid var(--green3);
  border-radius:2px;margin-top:1mm}

.callout{background:var(--deep);color:#dbe7e2;border-radius:3mm;padding:6mm 7mm;margin:5mm 0 5mm;
  position:relative;overflow:hidden}
.callout::after{content:"";position:absolute;right:-14mm;top:-14mm;width:40mm;height:40mm;border-radius:50%;
  background:radial-gradient(circle,rgba(0,255,174,.16) 0%,rgba(0,255,174,0) 70%)}
.callout h4{font-family:'Oswald',sans-serif;font-weight:500;font-size:11.5pt;text-transform:uppercase;
  letter-spacing:.03em;color:var(--green);margin:0 0 2.4mm}
.callout p{margin:0;font-size:9.9pt;line-height:1.6;color:#c5d3ce;text-align:left}

.tbl{margin:4mm 0 5mm}
table{width:100%;border-collapse:collapse;font-size:9.4pt}
thead th{background:var(--deep);color:var(--green3);font-family:'Oswald',sans-serif;font-weight:500;
  font-size:9.5pt;text-transform:uppercase;letter-spacing:.06em;text-align:left;padding:3.2mm 4mm}
thead th:first-child{border-top-left-radius:2mm}
thead th:last-child{border-top-right-radius:2mm}
tbody td{padding:3.4mm 4mm;border-bottom:1px solid var(--hair);vertical-align:top;color:#414b47;line-height:1.5}
tbody tr:nth-child(even) td{background:#f7faf9}
tbody td:first-child{color:var(--black);font-weight:500}
.tsub{font-family:'Space Mono',monospace;font-size:7.6pt;color:var(--soft);font-weight:400;
  text-transform:uppercase;letter-spacing:.04em}

/* ---------- página final ---------- */
.back{background:var(--black);color:#fff}
.back-in{position:absolute;left:24mm;right:24mm;top:32mm;bottom:24mm;display:flex;flex-direction:column}
.back .glow{position:absolute;width:150mm;height:150mm;left:-40mm;bottom:-50mm;border-radius:50%;
  background:radial-gradient(circle,rgba(0,255,174,.16) 0%,rgba(0,255,174,0) 68%)}
.back .kicker{font-family:'Space Mono',monospace;font-size:8pt;letter-spacing:.28em;
  text-transform:uppercase;color:var(--green);margin:0}
.back h2{font-family:'Oswald',sans-serif;font-weight:600;font-size:34pt;line-height:1.12;color:#fff;
  text-transform:uppercase;margin:6mm 0 0;display:block;letter-spacing:-.01em}
.back h2::before{display:none}
.back h2 em{font-style:normal;color:var(--green)}
.back .txt{font-size:11.4pt;line-height:1.6;color:#bcc8c3;margin:7mm 0 0;max-width:112mm;font-weight:300}
.back .chan{margin-top:11mm;display:flex;flex-direction:column;gap:0}
.back .chan a{display:flex;align-items:baseline;gap:4mm;padding:4.2mm 0;border-top:1px solid rgba(255,255,255,.14);
  text-decoration:none;color:#fff;font-size:11pt}
.back .chan a:last-child{border-bottom:1px solid rgba(255,255,255,.14)}
.back .chan .cl{font-family:'Space Mono',monospace;font-size:7.5pt;letter-spacing:.2em;text-transform:uppercase;
  color:var(--green3);min-width:26mm}
.back .closing{margin-top:auto;font-size:10pt;line-height:1.7;color:#8fa39c;font-weight:300;
  padding-bottom:9mm}
.back .foot{display:flex;justify-content:space-between;align-items:flex-end;
  border-top:1px solid rgba(255,255,255,.14);padding-top:7mm}
.back .wordmark{width:46mm}
.back .wordmark .cls-3{fill:#fff}
.back .rights{font-family:'Space Mono',monospace;font-size:7pt;letter-spacing:.1em;color:#71807a;
  text-align:right;line-height:1.8;text-transform:uppercase}

/* área de medição usada só durante a paginação */
#src{position:absolute;left:-9999px;top:0;width:166mm}
#ruler{position:absolute;left:-9999px;top:0;width:166mm}

/* O cartão 16:9 é só para exportar imagem (capa do post / og:image).
   Ele NÃO pode entrar no PDF — daí sumir na mídia de impressão. */
@media print { #card { display: none !important } }
`;

const PAGINATOR = `
(function(){
  var MM = (function(){ var d=document.createElement('div'); d.style.width='100mm';
    d.style.position='absolute'; document.body.appendChild(d);
    var w=d.getBoundingClientRect().width/100; d.remove(); return w; })();

  var sheets = document.getElementById('sheets');
  var src    = document.getElementById('src');
  var BODY_H = 297*MM - (22*MM) - (20*MM);   // altura útil da folha
  var pageNo = 2;                             // 1 = capa; sumário é a 2
  var chapterPages = {};

  function newPage(){
    var p = document.createElement('section');
    p.className = 'page';
    p.innerHTML = '<span class="page-edge"></span><div class="page-body"></div>' +
      '<div class="pfoot"><span>' + ${JSON.stringify(BOOK.title + ' — ' + BOOK.org)} +
      '</span><span class="pf-n">' + String(++pageNo).padStart(2,'0') + '</span></div>';
    sheets.appendChild(p);
    return p.querySelector('.page-body');
  }

  var body = newPage();
  var fits = function(){ return body.scrollHeight <= BODY_H + 1; };

  // divide um <p> longo em duas partes, achando por busca binária quantas
  // palavras cabem no espaço que sobrou na folha.
  function splitParagraph(node){
    var words = node.innerHTML.split(/(\\s+)/);
    var lo = 0, hi = words.length, best = 0;
    while (lo <= hi){
      var mid = (lo + hi) >> 1;
      node.innerHTML = words.slice(0, mid).join('');
      if (fits()){ best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    if (best < 3) { node.innerHTML = words.join(''); return null; }
    node.innerHTML = words.slice(0, best).join('');
    var rest = document.createElement('p');
    rest.innerHTML = words.slice(best).join('').replace(/^\\s+/, '');
    return rest.innerHTML.trim() ? rest : null;
  }

  // divide uma lista/tabela item a item: tira os últimos itens até o que sobrou
  // caber na folha e devolve um clone do container com o resto.
  function splitContainer(node){
    var isTable = node.hasAttribute('data-table');
    var host = isTable ? node.querySelector('tbody') : node;
    var removed = [];
    while (host.children.length > 1 && !fits()){
      var k = host.lastElementChild;
      host.removeChild(k);
      removed.unshift(k);
    }
    // precisa sobrar pelo menos um item na folha e pelo menos um pra próxima
    if (!removed.length || !fits()){
      removed.forEach(function(r){ host.appendChild(r); });
      return null;
    }
    var clone = node.cloneNode(false);
    var chost = clone;
    if (isTable){
      var t = node.querySelector('table').cloneNode(false);
      t.appendChild(node.querySelector('thead').cloneNode(true));
      chost = document.createElement('tbody');
      t.appendChild(chost);
      clone.appendChild(t);
    }
    removed.forEach(function(r){ chost.appendChild(r); });
    return clone;
  }

  var queue = Array.prototype.slice.call(src.children);
  while (queue.length){
    var node = queue.shift();

    // abertura de capítulo sempre começa numa folha nova (menos a primeira)
    if (node.hasAttribute('data-break') && body.children.length) body = newPage();

    body.appendChild(node);
    if (node.hasAttribute('data-chap')) chapterPages[node.getAttribute('data-chap')] = pageNo;
    if (fits()) continue;

    // não coube: tenta dividir o bloco (parágrafo por palavra, lista/tabela por item)
    var rest = null;
    if (node.hasAttribute('data-split')) rest = splitParagraph(node);
    else if (node.hasAttribute('data-items')) rest = splitContainer(node);
    if (rest){ body = newPage(); queue.unshift(rest); continue; }

    // indivisível: se está sozinho na folha, deixa estourar; senão vai inteiro pra próxima
    if (body.children.length === 1) continue;
    node.remove();
    body = newPage();
    body.appendChild(node);
    if (node.hasAttribute('data-chap')) chapterPages[node.getAttribute('data-chap')] = pageNo;
  }

  // um h2 nunca fica sozinho no pé da folha
  Array.prototype.forEach.call(sheets.querySelectorAll('.page-body'), function(pb, i, all){
    var last = pb.lastElementChild;
    var next = all[i+1];
    if (last && last.tagName === 'H2' && next && pb.children.length > 1
        && !(next.firstElementChild && next.firstElementChild.classList.contains('chap-open'))){
      next.insertBefore(last, next.firstChild);
    }
  });

  // preenche o sumário
  Array.prototype.forEach.call(document.querySelectorAll('[data-toc]'), function(li){
    var n = chapterPages[li.getAttribute('data-toc')];
    li.querySelector('.toc-page').textContent = n ? String(n).padStart(2,'0') : '--';
  });

  src.remove();
  window.__paginated = true;
})();
`;

const HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(BOOK.title)} — ${esc(BOOK.org)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>

<div id="sheets">

  <!-- ============ CAPA ============ -->
  <section class="page cover">
    <span class="grid"></span><span class="glow"></span><span class="glow2"></span>
    <div class="cover-in">
      ${CHEVRONS}
      <p class="kicker">${esc(BOOK.kicker)}</p>
      <h1>Smarketing<br><em>na Prática</em></h1>
      <span class="rule"></span>
      <p class="sub">${esc(BOOK.subtitle)}</p>
      <ul class="cover-list">
        <li>Critérios objetivos de MQL e SQL para parar a briga sobre “lead ruim”</li>
        <li>Modelo pronto de SLA entre marketing e comercial</li>
        <li>Matriz de objeções x conteúdo para acelerar o fechamento</li>
        <li>Checklist de 8 passos para aplicar já nesta semana</li>
      </ul>
      <div class="meta">
        ${WORDMARK}
        <div class="date"><b>${esc(BOOK.date)}</b>Guia gratuito · Distribuição livre</div>
      </div>
    </div>
  </section>

  <!-- ============ SUMÁRIO ============ -->
  <section class="page toc-page-sheet">
    <span class="page-edge"></span>
    <div class="page-body">
      <p class="toc-kick">O que você vai encontrar</p>
      <h1 class="toc-h">Sumário</h1>
      <span class="toc-rule"></span>
      <ol class="toc">${TOC_ROWS}</ol>
      <p class="toc-note"><b>Como usar este guia:</b> cada capítulo termina em algo aplicável na
      semana seguinte — um critério, um modelo de acordo ou uma rotina. Se você tem pouco tempo,
      comece pelo <b>Capítulo 3 (SLA)</b> e pelo <b>checklist final</b>: são as duas peças que
      destravam a maior parte do atrito entre marketing e comercial.</p>
    </div>
    <div class="pfoot"><span>${esc(BOOK.title)} — ${esc(BOOK.org)}</span><span class="pf-n">02</span></div>
  </section>

</div>

<!-- ============ PÁGINA FINAL (movida para o fim após paginar) ============ -->
<template id="backtpl">
  <section class="page back">
    <span class="glow"></span>
    <div class="back-in">
      <p class="kicker">Próximo passo</p>
      <h2>Quer isso<br>rodando na<br><em>sua operação?</em></h2>
      <p class="txt">A BAM estrutura a ponte entre marketing e comercial — do ICP ao SLA, da campanha
      ao CRM — para que o time de vendas receba lead com contexto e o investimento em mídia vire
      contrato assinado.</p>
      <div class="chan">
        <a href="https://www.bamassessoria.com/contato.html"><span class="cl">Site</span>bamassessoria.com</a>
        <a href="https://api.whatsapp.com/send/?phone=5511976259165"><span class="cl">WhatsApp</span>(11) 97625-9165</a>
        <a href="https://www.instagram.com/bam.assessoria/"><span class="cl">Instagram</span>@bam.assessoria</a>
      </div>
      <p class="closing">Este material é gratuito e pode ser compartilhado com o seu time.<br>
      Se ele destravou alguma conversa aí dentro, a gente quer saber.</p>
      <div class="foot">
        ${WORDMARK}
        <div class="rights">© ${(BOOK.date.match(/\d{4}/) || ['2026'])[0]} BAM Assessoria em Marketing<br>Todos os direitos reservados</div>
      </div>
    </div>
  </section>
</template>

<!-- Cartão 16:9 usado como capa do post no blog e como og:image.
     Fica fora de #sheets e some da impressão do PDF. -->
<section id="card" style="position:relative;width:1200px;height:675px;background:#050505;
  overflow:hidden;color:#fff">
  <span style="position:absolute;inset:0;opacity:.16;background-image:
    linear-gradient(rgba(87,245,195,.35) 1px,transparent 1px),
    linear-gradient(90deg,rgba(87,245,195,.35) 1px,transparent 1px);background-size:60px 60px"></span>
  <span style="position:absolute;width:620px;height:620px;right:-190px;top:-200px;border-radius:50%;
    background:radial-gradient(circle,rgba(0,255,174,.22) 0%,rgba(0,255,174,0) 68%)"></span>
  <div style="position:absolute;left:72px;right:72px;top:64px;bottom:60px;display:flex;flex-direction:column">
    <svg viewBox="120 254 672 398" style="width:96px;fill:#57F5C3;display:block">
      <polygon points="128.7 262 273.4 262 413.4 452.8 273.4 643.5 128.7 643.5 268.7 452.8 128.7 262"/>
      <polygon points="313.7 262 458.3 262 598.3 452.8 458.3 643.5 313.7 643.5 453.7 452.8 313.7 262"/>
      <polygon points="498.6 262 643.3 262 783.3 452.8 643.3 643.5 498.6 643.5 638.6 452.8 498.6 262"/>
      <circle cx="738.3" cy="598.6" r="45"/>
    </svg>
    <p style="font-family:'Space Mono',monospace;font-size:15px;letter-spacing:.30em;text-transform:uppercase;
      color:#00FFAE;margin:38px 0 0">Marketing + Vendas &middot; B2B</p>
    <h1 style="font-family:'Oswald',sans-serif;font-weight:600;font-size:76px;line-height:1.06;
      text-transform:uppercase;letter-spacing:-.015em;margin:16px 0 0;max-width:900px">
      Marketing entrega.<br>Vendas reclama.<br><span style="color:#00FFAE">E a meta não fecha.</span></h1>
    <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;
      border-top:1px solid rgba(255,255,255,.16);padding-top:24px">
      <span style="font-size:19px;color:#c2cec9;font-weight:300">Como estruturar o Smarketing na sua operação</span>
      <span style="font-family:'Space Mono',monospace;font-size:13px;letter-spacing:.18em;
        text-transform:uppercase;color:#57F5C3">BAM Assessoria</span>
    </div>
  </div>
</section>

<!-- fluxo de conteúdo (some depois da paginação) -->
<div id="src">
${FLOW}
</div>

<script>
document.fonts.ready.then(function(){
  setTimeout(function(){
    ${PAGINATOR}
    var tpl = document.getElementById('backtpl');
    document.getElementById('sheets').appendChild(tpl.content.cloneNode(true));
    tpl.remove();
    window.__done = true;
  }, 60);
});
</script>
</body>
</html>
`;

/* ---------- escreve o preview ---------- */
writeFileSync(PREVIEW, HTML);
console.log(`preview: ${PREVIEW}`);

/* ---------- imprime em PDF via CDP ---------- */
const chromePath = CHROMES.find((p) => existsSync(p));
if (!chromePath) {
  console.error('Chrome/Edge não encontrado. O preview HTML foi gerado; abra e use "Imprimir → Salvar em PDF".');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + resolve('tools/.chrome-ebook'),
  'about:blank',
], { stdio: 'ignore' });

async function getWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const pg = list.find((t) => t.type === 'page');
      if (pg?.webSocketDebuggerUrl) return pg.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error('Chrome remote-debugging não respondeu');
}

function makeClient(ws) {
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) waiters.forEach((w) => w(m));
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const once = (method) => new Promise((res) => {
    const w = (m) => { if (m.method === method) { waiters.splice(waiters.indexOf(w), 1); res(m.params); } };
    waiters.push(w);
  });
  return { send, once };
}

try {
  const ws = new WebSocket(await getWs());
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const cdp = makeClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1200, deviceScaleFactor: 1, mobile: false });

  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: pathToFileURL(resolve(PREVIEW)).href });
  await Promise.race([loaded, sleep(15000)]);

  // espera a paginação terminar
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const r = await cdp.send('Runtime.evaluate', { expression: 'window.__done === true' });
    if (r.result?.value === true) { ready = true; break; }
    await sleep(300);
  }
  if (!ready) throw new Error('a paginação não concluiu (fontes não carregaram?)');
  await sleep(500);

  const pages = await cdp.send('Runtime.evaluate', { expression: 'document.querySelectorAll(".page").length' });

  const { data } = await cdp.send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    paperWidth: 8.27,
    paperHeight: 11.69,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    displayHeaderFooter: false,
  });

  mkdirSync('assets/ebooks', { recursive: true });
  writeFileSync(OUT_PDF, Buffer.from(data, 'base64'));
  const kb = Math.round(Buffer.from(data, 'base64').length / 1024);
  console.log(`ok: ${OUT_PDF} — ${pages.result.value} páginas, ${kb} KB`);

  // capa em WebP, usada como mockup na landing page
  const box = JSON.parse((await cdp.send('Runtime.evaluate', {
    expression: `(()=>{const r=document.querySelector('.page').getBoundingClientRect();
      return JSON.stringify({x:r.x+scrollX,y:r.y+scrollY,w:r.width,h:r.height})})()`,
  })).result.value);
  const cover = await cdp.send('Page.captureScreenshot', {
    format: 'webp', quality: 90, captureBeyondViewport: true,
    clip: { x: box.x, y: box.y, width: Math.round(box.w), height: Math.round(box.h), scale: 1.2 },
  });
  mkdirSync('assets/img/ebooks', { recursive: true });
  writeFileSync(OUT_COVER, Buffer.from(cover.data, 'base64'));
  console.log(`ok: ${OUT_COVER} — ${Math.round(Buffer.from(cover.data, 'base64').length / 1024)} KB`);

  // cartão 16:9 (capa do post no blog + og:image)
  const cbox = JSON.parse((await cdp.send('Runtime.evaluate', {
    expression: `(()=>{const r=document.getElementById('card').getBoundingClientRect();
      return JSON.stringify({x:r.x+scrollX,y:r.y+scrollY})})()`,
  })).result.value);
  const card = await cdp.send('Page.captureScreenshot', {
    format: 'webp', quality: 92, captureBeyondViewport: true,
    clip: { x: cbox.x, y: cbox.y, width: 1200, height: 675, scale: 1 },
  });
  mkdirSync('assets/img/blog', { recursive: true });
  writeFileSync(OUT_CARD, Buffer.from(card.data, 'base64'));
  console.log(`ok: ${OUT_CARD} — ${Math.round(Buffer.from(card.data, 'base64').length / 1024)} KB`);
  ws.close();
} finally {
  chrome.kill();
}
