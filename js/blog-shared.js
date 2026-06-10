/* =============================================================
   BAM Assessoria — utilidades compartilhadas do blog (cliente)
   Espelham a lógica de tools/build.mjs para manter posts dinâmicos
   (Firestore) visualmente idênticos aos posts estáticos.
   ============================================================= */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y) return '';
  return `${d} ${MESES[(m || 1) - 1]} ${y}`;
}

export function readingTime(html) {
  const words = String(html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/* Gera slug (sem acento, kebab-case) a partir do título. */
export function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

export function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function escapeAttr(s = '') {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/* Monta o cartão do post para o índice do blog, idêntico ao .pcard estático.
   `prefix` é o caminho até a pasta /blog (no índice do blog é '' pois já estamos lá). */
export function postCardHtml(p, prefix = '') {
  const thumb = p.coverUrl
    ? `<div class="thumb"><img src="${escapeAttr(p.coverUrl)}" alt="${escapeAttr(p.title)}" loading="lazy" decoding="async"></div>`
    : `<div class="thumb brand"><img src="${prefix}../assets/svg/logo-icon.svg" alt="" aria-hidden="true"></div>`;
  const cat = p.category ? `<span class="pcat">${escapeHtml(p.category)}</span>` : '';
  const search = (p.title + ' ' + (p.category || '') + ' ' + (p.excerpt || '')).toLowerCase();
  return `<a class="pcard in" href="${prefix}post.html?slug=${encodeURIComponent(p.slug)}" data-post="${escapeAttr(search)}" data-hover>
  ${thumb}
  <div class="pbody">
    <div class="pmeta">${cat}<span class="date">${fmtDate(p.date)}</span></div>
    <h3>${escapeHtml(p.title)}</h3>
    <p>${escapeHtml(p.excerpt || '')}</p>
    <span class="pgo">Ler artigo <span class="ar">→</span></span>
  </div>
</a>`;
}
