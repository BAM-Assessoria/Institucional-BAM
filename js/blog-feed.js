/* =============================================================
   BAM Assessoria — feed dinâmico do índice do blog
   Lê os posts criados pela página /admin (coleção "posts" no Firestore)
   e os adiciona no topo da grade, antes dos posts estáticos. Se o Firebase
   não estiver configurado, não faz nada (o blog estático continua intacto).
   ============================================================= */
import { firebaseConfig, firebaseReady, SDK } from './firebase-config.js';
import { postCardHtml } from './blog-shared.js';

if (firebaseReady) load();

async function load() {
  const grid = document.getElementById('postsGrid');
  const countEl = document.getElementById('blogCount');
  if (!grid) return;
  try {
    const { initializeApp } = await import(`${SDK}/firebase-app.js`);
    const { getFirestore, collection, getDocs, query, orderBy } =
      await import(`${SDK}/firebase-firestore.js`);

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const snap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'desc')));
    if (snap.empty) return;

    // Monta o HTML de todos os posts dinâmicos e insere no início da grade.
    const html = snap.docs.map((d) => postCardHtml({ ...d.data(), slug: d.data().slug || d.id })).join('');
    grid.insertAdjacentHTML('afterbegin', html);

    // Atualiza a contagem (estáticos + dinâmicos).
    if (countEl) {
      const total = (parseInt(countEl.dataset.static, 10) || 0) + snap.size;
      countEl.textContent = total + (total === 1 ? ' artigo' : ' artigos');
    }
  } catch (e) {
    console.warn('[BAM] Posts dinâmicos indisponíveis:', e);
  }
}
