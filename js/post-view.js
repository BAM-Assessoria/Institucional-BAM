/* =============================================================
   BAM Assessoria — visualizador de post dinâmico (blog/post.html)
   Lê ?slug=... da URL, busca o post na coleção "posts" do Firestore
   e renderiza com o mesmo layout dos artigos estáticos.
   ============================================================= */
import { firebaseConfig, firebaseReady, SDK } from './firebase-config.js';
import { fmtDate, readingTime } from './blog-shared.js';

const titleEl = document.getElementById('postTitle');
const metaEl = document.getElementById('postMeta');
const bodyEl = document.getElementById('postBody');
const coverEl = document.getElementById('postCover');
const coverImg = document.getElementById('postCoverImg');

const slug = new URLSearchParams(location.search).get('slug');

function fail(msg) {
  if (titleEl) titleEl.textContent = 'Artigo não encontrado';
  if (metaEl) metaEl.innerHTML = '';
  if (bodyEl) bodyEl.innerHTML = `<p style="color:var(--gray)">${msg} <a href="index.html" style="color:var(--green)">Voltar ao blog →</a></p>`;
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
    const { initializeApp } = await import(`${SDK}/firebase-app.js`);
    const { getFirestore, collection, getDocs, query, where, limit } =
      await import(`${SDK}/firebase-firestore.js`);

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const snap = await getDocs(query(collection(db, 'posts'), where('slug', '==', slug), limit(1)));
    if (snap.empty) { fail('Esse artigo não existe ou foi removido.'); return; }

    const p = snap.docs[0].data();

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
    if (bodyEl) bodyEl.innerHTML = p.bodyHtml || '';

    // dispara os reveals (.r) que porventura existam no conteúdo
    document.querySelectorAll('.r:not(.in)').forEach((el) => el.classList.add('in'));
  } catch (e) {
    console.warn('[BAM] Erro ao carregar o artigo:', e);
    fail('Não foi possível carregar o artigo agora.');
  }
}

function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
