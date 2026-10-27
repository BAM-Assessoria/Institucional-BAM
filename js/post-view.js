/* =============================================================
   BAM Assessoria — visualizador de post dinâmico (blog/post.html)
   Lê ?slug=... da URL, busca o post na coleção "posts" do Firestore
   e renderiza com o mesmo layout dos artigos estáticos.
   Post agendado só abre antes da hora com ?preview=1 (o link de
   prévia que o painel gera), e aí mostra um aviso no topo.
   ============================================================= */
import { firebaseReady } from './firebase-config.js';
import { bootFirestore } from './firebase-boot.js';
import { fmtDate, readingTime, siteOf, publishMs } from './blog-shared.js';

const titleEl = document.getElementById('postTitle');
const metaEl = document.getElementById('postMeta');
const bodyEl = document.getElementById('postBody');
const coverEl = document.getElementById('postCover');
const coverImg = document.getElementById('postCoverImg');

const params = new URLSearchParams(location.search);
const slug = params.get('slug');

function fail(msg) {
  if (titleEl) titleEl.textContent = 'Artigo não encontrado';
  if (metaEl) metaEl.innerHTML = '';
  if (bodyEl) bodyEl.innerHTML = `<p style="color:var(--gray)">${msg} <a href="./" style="color:var(--green)">Voltar ao blog →</a></p>`;
}

if (!firebaseReady) {
  fail('O blog ainda não está configurado.');
} else if (!slug) {
  fail('Endereço inválido.');
} else {
  render();
}

async function render() {
  try {
    const { fs, db } = await bootFirestore();
    const { collection, getDocs, query, where, limit } = fs;
    const snap = await getDocs(query(collection(db, 'posts'), where('slug', '==', slug), limit(1)));
    if (snap.empty) { fail('Esse artigo não existe ou foi removido.'); return; }

    const p = snap.docs[0].data();
    // Posts do blog da BAM Tec moram no mesmo Firestore, mas não abrem aqui.
    if (siteOf(p) !== 'bam') { fail('Esse artigo não existe ou foi removido.'); return; }
    const scheduled = publishMs(p) > Date.now();
    if (scheduled && !params.has('preview')) { fail('Esse artigo ainda não foi publicado.'); return; }

    document.title = `${p.title} | Blog BAM Assessoria`;
    if (titleEl) titleEl.textContent = p.title;
    if (metaEl) {
      const cat = p.category || 'Marketing';
      metaEl.innerHTML =
        `<span>${escapeHtml(cat)}</span><span class="dim">${fmtDate(p.date)} · ${readingTime(p.bodyHtml)} min de leitura</span>`;
    }
    if (p.coverUrl && coverEl && coverImg) {
      coverImg.src = p.coverUrl;
      coverImg.alt = p.title;
      coverEl.hidden = false;
    }
    if (bodyEl) bodyEl.innerHTML = (scheduled ? previewNote(publishMs(p)) : '') + (p.bodyHtml || '');

    // dispara os reveals (.r) que porventura existam no conteúdo
    document.querySelectorAll('.r:not(.in)').forEach((el) => el.classList.add('in'));
  } catch (e) {
    console.warn('[BAM] Erro ao carregar o artigo:', e);
    fail('Não foi possível carregar o artigo agora.');
  }
}

function previewNote(ms) {
  const when = new Date(ms).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  return `<p style="border:1px solid var(--green);border-radius:10px;padding:14px 18px;font-family:var(--mono);font-size:13px;color:var(--green)">Pré-visualização · este artigo está agendado para ${when} e ainda não aparece no blog.</p>`;
}

function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
