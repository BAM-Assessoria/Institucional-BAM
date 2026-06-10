/* =============================================================
   BAM Assessoria — painel de publicação (lógica)
   Firebase: Auth (login) + Firestore (posts) + Storage (capas).
   ============================================================= */
import { firebaseConfig, firebaseReady, SDK } from '../js/firebase-config.js';
import { slugify } from '../js/blog-shared.js';

const $ = (id) => document.getElementById(id);
const views = { setup: $('setupView'), login: $('loginView'), app: $('appView') };
const show = (name) => { for (const k in views) views[k].classList.toggle('hidden', k !== name); };

if (!firebaseReady) {
  show('setup');
} else {
  boot().catch((e) => {
    console.error(e);
    show('setup');
  });
}

async function boot() {
  const { initializeApp } = await import(`${SDK}/firebase-app.js`);
  const auth = await import(`${SDK}/firebase-auth.js`);
  const fs = await import(`${SDK}/firebase-firestore.js`);
  const st = await import(`${SDK}/firebase-storage.js`);

  const app = initializeApp(firebaseConfig);
  const authn = auth.getAuth(app);
  const db = fs.getFirestore(app);
  const storage = st.getStorage(app);

  let coverFile = null;

  /* ---------- estado de autenticação ---------- */
  auth.onAuthStateChanged(authn, (user) => {
    if (user) {
      $('whoami').textContent = user.email || '';
      show('app');
      loadList();
    } else {
      show('login');
    }
  });

  /* ---------- login ---------- */
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('loginBtn'); const msg = $('loginMsg');
    msg.classList.remove('show');
    const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    try {
      await auth.signInWithEmailAndPassword(authn, $('email').value.trim(), $('senha').value);
      $('senha').value = '';
    } catch (err) {
      msg.textContent = authError(err); msg.classList.add('show');
    } finally {
      btn.disabled = false; btn.innerHTML = old;
    }
  });
  $('logoutBtn').addEventListener('click', () => auth.signOut(authn));

  /* ---------- data padrão + slug ao vivo ---------- */
  $('data').value = todayISO();
  $('titulo').addEventListener('input', () => {
    const s = slugify($('titulo').value);
    $('slugPreview').textContent = s ? `/blog/post.html?slug=${s}` : '/blog/post.html?slug=…';
  });

  /* ---------- capa ---------- */
  $('cover').addEventListener('change', (e) => {
    coverFile = e.target.files[0] || null;
    $('coverPrev').style.backgroundImage = coverFile ? `url("${URL.createObjectURL(coverFile)}")` : '';
  });

  /* ---------- barra de formatação ---------- */
  document.querySelectorAll('.toolbar button').forEach((b) => {
    b.addEventListener('mousedown', (e) => e.preventDefault()); // preserva a seleção
    b.addEventListener('click', () => {
      $('editor').focus();
      const { cmd, val } = b.dataset;
      if (cmd === 'createLink') {
        const url = prompt('Endereço do link (https://…):');
        if (url) document.execCommand('createLink', false, url.trim());
      } else if (cmd === 'formatBlock') {
        document.execCommand('formatBlock', false, val);
      } else {
        document.execCommand(cmd, false, null);
      }
    });
  });

  /* ---------- publicar ---------- */
  $('postForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = $('okMsg'); const err = $('errMsg');
    ok.classList.remove('show'); err.classList.remove('show');

    const title = $('titulo').value.trim();
    const date = $('data').value;
    const excerpt = $('resumo').value.trim();
    const category = $('categoria').value.trim();
    const bodyHtml = cleanHtml($('editor'));

    if (!title || !date || !excerpt) return reject(err, 'Preencha título, data e resumo.');
    if (bodyHtml.replace(/<[^>]+>/g, '').trim().length < 40) return reject(err, 'O conteúdo do artigo está muito curto.');

    const btn = $('publishBtn'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Publicando…';
    try {
      const slug = await uniqueSlug(slugify(title) || 'artigo');
      let coverUrl = null, coverPath = null;
      if (coverFile) {
        const ext = ((coverFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'jpg';
        coverPath = `blog/${slug}.${ext}`;
        const ref = st.ref(storage, coverPath);
        await st.uploadBytes(ref, coverFile, { contentType: coverFile.type || 'image/jpeg' });
        coverUrl = await st.getDownloadURL(ref);
      }
      await fs.addDoc(fs.collection(db, 'posts'), {
        slug, title, date, category: category || null, excerpt,
        coverUrl, coverPath, bodyHtml, createdAt: fs.serverTimestamp(),
      });
      ok.innerHTML = `Artigo publicado! <a target="_blank" href="../blog/post.html?slug=${encodeURIComponent(slug)}">Abrir artigo →</a>`;
      ok.classList.add('show');
      resetForm();
      loadList();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e2) {
      reject(err, 'Não foi possível publicar: ' + (e2.message || e2));
    } finally {
      btn.disabled = false; btn.innerHTML = old;
    }
  });

  $('resetBtn').addEventListener('click', resetForm);

  /* ---------- lista de posts do painel ---------- */
  async function loadList() {
    const ul = $('postList'); const empty = $('listEmpty');
    ul.innerHTML = '';
    let snap;
    try {
      snap = await fs.getDocs(fs.query(fs.collection(db, 'posts'), fs.orderBy('date', 'desc')));
    } catch (e) { empty.textContent = 'Não foi possível carregar a lista.'; empty.style.display = ''; return; }
    empty.style.display = snap.empty ? '' : 'none';
    snap.forEach((docSnap) => {
      const p = docSnap.data();
      const li = document.createElement('li'); li.className = 'pitem';
      li.innerHTML =
        `<div class="meta"><b></b><span></span></div>
         <div class="grp">
           <a class="btn ghost" target="_blank" href="../blog/post.html?slug=${encodeURIComponent(p.slug || docSnap.id)}">Abrir</a>
           <button class="btn danger" type="button">Excluir</button>
         </div>`;
      li.querySelector('b').textContent = p.title || '(sem título)';
      li.querySelector('span').textContent = (p.date || '') + (p.category ? ' · ' + p.category : '');
      li.querySelector('.danger').addEventListener('click', () => removePost(docSnap.id, p));
      ul.appendChild(li);
    });
  }

  async function removePost(id, p) {
    if (!confirm(`Excluir “${p.title}”? Esta ação não pode ser desfeita.`)) return;
    try {
      await fs.deleteDoc(fs.doc(db, 'posts', id));
      if (p.coverPath) { try { await st.deleteObject(st.ref(storage, p.coverPath)); } catch (_) {} }
      loadList();
    } catch (e) { alert('Erro ao excluir: ' + (e.message || e)); }
  }

  function resetForm() {
    $('postForm').reset();
    $('editor').innerHTML = '';
    $('data').value = todayISO();
    $('slugPreview').textContent = '/blog/post.html?slug=…';
    $('coverPrev').style.backgroundImage = '';
    coverFile = null;
  }
}

/* ===================== utilidades ===================== */
function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
function reject(el, m) { el.textContent = m; el.classList.add('show'); }

function authError(err) {
  const c = (err && err.code) || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found'))
    return 'E-mail ou senha incorretos.';
  if (c.includes('invalid-email')) return 'E-mail inválido.';
  if (c.includes('too-many-requests')) return 'Muitas tentativas. Aguarde um momento e tente de novo.';
  if (c.includes('network')) return 'Sem conexão. Verifique a internet.';
  return 'Não foi possível entrar. Tente novamente.';
}

/* Normaliza o HTML do editor para tags limpas (mesmo padrão dos posts estáticos). */
function cleanHtml(srcEl) {
  const tmp = document.createElement('div');
  tmp.innerHTML = srcEl.innerHTML;
  tmp.querySelectorAll('b').forEach((n) => rename(n, 'strong'));
  tmp.querySelectorAll('i').forEach((n) => rename(n, 'em'));
  tmp.querySelectorAll('div').forEach((n) => rename(n, 'p'));
  const allowed = { P: 1, H2: 1, H3: 1, UL: 1, OL: 1, LI: 1, STRONG: 1, EM: 1, A: 1, BLOCKQUOTE: 1, BR: 1 };
  [...tmp.querySelectorAll('*')].forEach((n) => {
    [...n.attributes].forEach((a) => {
      if (n.tagName === 'A' && a.name === 'href') return;
      n.removeAttribute(a.name);
    });
    if (n.tagName === 'A') {
      const href = n.getAttribute('href') || '';
      if (/^(https?:|mailto:|\/)/i.test(href)) {
        n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer');
      } else { n.removeAttribute('href'); }
    }
    if (!allowed[n.tagName]) unwrap(n);
  });
  tmp.querySelectorAll('p,h2,h3,li,blockquote').forEach((n) => {
    if (!n.textContent.trim() && !n.querySelector('br,img')) n.remove();
  });
  return tmp.innerHTML.trim();
}
function rename(n, tag) {
  const e = document.createElement(tag);
  while (n.firstChild) e.appendChild(n.firstChild);
  n.replaceWith(e);
}
function unwrap(n) {
  const p = n.parentNode; if (!p) return;
  while (n.firstChild) p.insertBefore(n.firstChild, n);
  p.removeChild(n);
}
