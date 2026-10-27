/* =============================================================
   BAM Assessoria — painel do blog (lógica)
   Firebase: Auth (login) + Firestore (posts) + Storage (capas).

   Um painel só para os dois blogs do projeto Firebase: cada post
   leva `site` ('bam' ou 'bamtec') e cada site mostra só os seus.
   `publishAt` diz quando o post entra no ar: no passado ele já
   aparece; no futuro fica na lista de programados e os blogs o
   escondem até a hora chegar (sem servidor: quem filtra é o
   próprio blog na hora de montar a página).
   ============================================================= */
import { firebaseReady, SDK } from '../js/firebase-config.js';
import { boot as bootFirebase } from '../js/firebase-boot.js';
import { slugify, fmtDate, siteOf, publishMs } from '../js/blog-shared.js';

const SITES = {
  bam: { label: 'BAM Assessoria', host: 'www.bamassessoria.com', blog: '../blog/' },
  bamtec: { label: 'BAM Tec', host: 'tec.bamassessoria.com', blog: 'https://tec.bamassessoria.com/blog/' },
};

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
  // Inicializa o app já com App Check (ver js/firebase-boot.js). Com a
  // exigência ligada no console, sem esse token o Firestore e o Storage
  // recusam tudo — inclusive o login neste painel.
  const app = await bootFirebase();
  const auth = await import(`${SDK}/firebase-auth.js`);
  const fs = await import(`${SDK}/firebase-firestore.js`);
  const st = await import(`${SDK}/firebase-storage.js`);

  const authn = auth.getAuth(app);
  const db = fs.getFirestore(app);
  const storage = st.getStorage(app);

  let coverFile = null;
  let removeCover = false;
  let editing = null; // post aberto no formulário ({ id, ...dados }) ou null
  let posts = [];     // todos os posts do painel, dos dois blogs
  let filtro = '';    // '' = todos os blogs

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

  /* ---------- data/hora padrão + slug e botão ao vivo ---------- */
  $('quando').value = localInput();
  $('titulo').addEventListener('input', syncForm);
  $('quando').addEventListener('input', syncForm);
  document.querySelectorAll('input[name=site]').forEach((r) => r.addEventListener('change', syncForm));
  syncForm();

  // A lista e o rótulo do botão dependem do relógio: um agendado vira
  // publicado quando a hora passa, mesmo com o painel aberto.
  setInterval(() => { renderLists(); syncForm(); }, 60000);

  /* ---------- capa ---------- */
  $('cover').addEventListener('change', (e) => {
    coverFile = e.target.files[0] || null;
    if (coverFile) removeCover = false;
    $('coverPrev').style.backgroundImage = coverFile ? `url("${URL.createObjectURL(coverFile)}")`
      : editing && editing.coverUrl && !removeCover ? `url("${editing.coverUrl}")` : '';
  });
  $('coverRemove').addEventListener('click', () => {
    removeCover = true; coverFile = null;
    $('cover').value = '';
    $('coverPrev').style.backgroundImage = '';
    $('coverRemove').classList.add('hidden');
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

  /* ---------- publicar / agendar / salvar ---------- */
  $('postForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = $('okMsg'); const err = $('errMsg');
    ok.classList.remove('show'); err.classList.remove('show');

    const site = currentSite();
    const title = $('titulo').value.trim();
    const when = new Date($('quando').value);
    const excerpt = $('resumo').value.trim();
    const category = $('categoria').value.trim();
    const bodyHtml = cleanHtml($('editor'));

    if (!title || isNaN(when) || !excerpt) return reject(err, 'Preencha título, data de publicação e resumo.');
    if (bodyHtml.replace(/<[^>]+>/g, '').trim().length < 40) return reject(err, 'O conteúdo do artigo está muito curto.');

    const future = when.getTime() > Date.now();
    if (editing && isLive(editing) && future &&
        !confirm(`Este artigo já está no ar. Com a nova data ele sai do blog e só volta em ${fmtWhen(when.getTime())}. Continuar?`)) return;

    const btn = $('publishBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Salvando…';
    try {
      // O endereço de um post que já foi ao ar não muda (o link pode ter
      // sido compartilhado). Enquanto ainda está agendado, acompanha o título.
      const base = slugify(title) || 'artigo';
      const slug = editing && isLive(editing) ? editing.slug : await uniqueSlug(base, editing && editing.id);

      const data = {
        site, slug, title, date: $('quando').value.slice(0, 10),
        publishAt: fs.Timestamp.fromDate(when),
        category: category || null, excerpt, bodyHtml,
        updatedAt: fs.serverTimestamp(),
      };
      if (coverFile) {
        // Nome novo a cada envio: trocar a capa não esbarra em cache da imagem antiga.
        const ext = ((coverFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'jpg';
        data.coverPath = `blog/${slug}-${Date.now().toString(36)}.${ext}`;
        const ref = st.ref(storage, data.coverPath);
        await st.uploadBytes(ref, coverFile, { contentType: coverFile.type || 'image/jpeg' });
        data.coverUrl = await st.getDownloadURL(ref);
      } else if (removeCover || !editing) {
        data.coverUrl = null; data.coverPath = null;
      }

      if (editing) {
        await fs.updateDoc(fs.doc(db, 'posts', editing.id), data);
        const oldPath = editing.coverPath;
        if (oldPath && 'coverPath' in data && data.coverPath !== oldPath) {
          try { await st.deleteObject(st.ref(storage, oldPath)); } catch (_) {}
        }
      } else {
        await fs.addDoc(fs.collection(db, 'posts'), { ...data, createdAt: fs.serverTimestamp() });
      }

      const p = { site, slug };
      const where = `no blog ${SITES[site].label}`;
      ok.innerHTML = editing
        ? `Alterações salvas. <a target="_blank" rel="noopener" href="${postUrl(p, future)}">${future ? 'Pré-visualizar' : 'Abrir artigo'} →</a>`
        : future
          ? `Artigo agendado ${where} para ${fmtWhen(when.getTime())}. <a target="_blank" rel="noopener" href="${postUrl(p, true)}">Pré-visualizar →</a>`
          : `Artigo publicado ${where}! <a target="_blank" rel="noopener" href="${postUrl(p, false)}">Abrir artigo →</a>`;
      ok.classList.add('show');
      resetForm(site);
      loadList();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e2) {
      reject(err, 'Não foi possível salvar: ' + (e2.message || e2));
    } finally {
      btn.disabled = false;
      syncForm();
    }
  });

  $('resetBtn').addEventListener('click', () => resetForm(currentSite()));

  /* ---------- gestão: programados + publicados ---------- */
  document.querySelectorAll('input[name=filtro]').forEach((r) => r.addEventListener('change', () => {
    filtro = r.value;
    renderLists();
  }));

  async function loadList() {
    try {
      const snap = await fs.getDocs(fs.collection(db, 'posts'));
      posts = snap.docs.map((d) => ({ id: d.id, ...d.data(), slug: d.data().slug || d.id }));
      $('listErr').classList.add('hidden');
    } catch (e) {
      posts = [];
      $('listErr').classList.remove('hidden');
    }
    renderLists();
  }

  function renderLists() {
    const now = Date.now();
    const mine = posts.filter((p) => !filtro || siteOf(p) === filtro);
    fillList('sched', mine.filter((p) => publishMs(p) > now).sort((a, b) => publishMs(a) - publishMs(b)), true);
    fillList('pub', mine.filter((p) => publishMs(p) <= now).sort((a, b) => publishMs(b) - publishMs(a)), false);
  }

  function fillList(key, list, scheduled) {
    const ul = $(key + 'List');
    ul.innerHTML = '';
    $(key + 'Count').textContent = list.length;
    $(key + 'Empty').classList.toggle('hidden', list.length > 0);
    list.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'pitem' + (editing && editing.id === p.id ? ' editing' : '');
      li.innerHTML =
        `<div class="meta"><b></b><span><i></i><em></em></span></div>
         <div class="grp">
           <a class="btn ghost sm" target="_blank" rel="noopener"></a>
           ${scheduled ? '<button class="btn ghost sm" type="button" data-act="now">Publicar agora</button>' : ''}
           <button class="btn ghost sm" type="button" data-act="edit">Editar</button>
           <button class="btn danger" type="button" data-act="del">Excluir</button>
         </div>`;
      const ms = publishMs(p);
      li.querySelector('b').textContent = p.title || '(sem título)';
      li.querySelector('i').textContent = SITES[siteOf(p)].label;
      li.querySelector('em').textContent =
        [scheduled ? `${fmtWhen(ms)} · ${fromNow(ms)}` : fmtDate(p.date), p.category].filter(Boolean).join(' · ');
      const a = li.querySelector('a');
      a.href = postUrl(p, scheduled);
      a.textContent = scheduled ? 'Prévia' : 'Ver';
      li.querySelector('[data-act=edit]').addEventListener('click', () => startEdit(p));
      li.querySelector('[data-act=del]').addEventListener('click', () => removePost(p));
      if (scheduled) li.querySelector('[data-act=now]').addEventListener('click', () => publishNow(p));
      ul.appendChild(li);
    });
  }

  function startEdit(p) {
    resetForm(siteOf(p));
    editing = p;
    $('titulo').value = p.title || '';
    $('quando').value = localInput(new Date(publishMs(p)));
    $('categoria').value = p.category || '';
    $('resumo').value = p.excerpt || '';
    $('editor').innerHTML = p.bodyHtml || '';
    $('coverPrev').style.backgroundImage = p.coverUrl ? `url("${p.coverUrl}")` : '';
    $('coverRemove').classList.toggle('hidden', !p.coverUrl);
    $('okMsg').classList.remove('show'); $('errMsg').classList.remove('show');
    syncForm();
    renderLists();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function publishNow(p) {
    if (!confirm(`Publicar “${p.title}” agora?`)) return;
    try {
      await fs.updateDoc(fs.doc(db, 'posts', p.id), {
        publishAt: fs.Timestamp.now(), date: todayISO(), updatedAt: fs.serverTimestamp(),
      });
      if (editing && editing.id === p.id) resetForm(currentSite());
      loadList();
    } catch (e) { alert('Erro ao publicar: ' + (e.message || e)); }
  }

  async function removePost(p) {
    if (!confirm(`Excluir “${p.title}”? Esta ação não pode ser desfeita.`)) return;
    try {
      await fs.deleteDoc(fs.doc(db, 'posts', p.id));
      if (p.coverPath) { try { await st.deleteObject(st.ref(storage, p.coverPath)); } catch (_) {} }
      if (editing && editing.id === p.id) resetForm(currentSite());
      loadList();
    } catch (e) { alert('Erro ao excluir: ' + (e.message || e)); }
  }

  /* Slug livre na coleção inteira (os dois blogs dividem a coleção).
     `selfId` é o próprio post, quando ele está sendo editado. */
  async function uniqueSlug(base, selfId) {
    for (let i = 1; ; i++) {
      const s = i === 1 ? base : `${base}-${i}`;
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'posts'), fs.where('slug', '==', s), fs.limit(2)));
      if (snap.docs.every((d) => d.id === selfId)) return s;
    }
  }

  /* Cabeçalho, slug, aviso de data e botão acompanham o que está no formulário. */
  function syncForm() {
    const site = currentSite();
    const when = new Date($('quando').value);
    const future = !isNaN(when) && when.getTime() > Date.now();

    $('formEyebrow').textContent = editing ? 'Editando artigo' : 'Novo artigo';
    $('formHeading').innerHTML = editing ? 'Editar <span class="g">artigo.</span>' : 'Publicar no <span class="g">blog.</span>';
    $('formLead').textContent = editing
      ? 'As alterações valem assim que você salvar. Mudar a data para o futuro tira o artigo do ar até lá.'
      : 'Escolha o blog, preencha os campos e defina quando o artigo entra no ar: agora ou numa data futura.';
    $('resetBtn').textContent = editing ? 'Cancelar edição' : 'Limpar tudo';

    const fixed = editing && isLive(editing);
    const slug = fixed ? editing.slug : slugify($('titulo').value);
    $('slugPreview').textContent = `${SITES[site].host}/blog/post?slug=${slug || '…'}`;
    $('slugNote').textContent = fixed ? '(já está no ar, não muda)' : '';

    $('quandoHint').innerHTML = isNaN(when) ? ''
      : future ? `Agendado: entra no ar em <b>${fmtWhen(when.getTime())}</b>.`
      : editing && isLive(editing) ? 'Já está no ar.'
      : 'Entra no ar assim que você salvar.';

    if (!$('publishBtn').disabled) {
      const label = editing ? 'Salvar alterações' : future ? 'Agendar artigo' : 'Publicar artigo';
      $('publishBtn').innerHTML = `${label} <span class="ar">→</span>`;
    }
  }

  function resetForm(site = 'bam') {
    $('postForm').reset();
    editing = null;
    coverFile = null; removeCover = false;
    $('editor').innerHTML = '';
    $('quando').value = localInput();
    $('coverPrev').style.backgroundImage = '';
    $('coverRemove').classList.add('hidden');
    document.querySelector(`input[name=site][value=${site}]`).checked = true;
    syncForm();
    renderLists();
  }
}

/* ===================== utilidades ===================== */
function currentSite() {
  return document.querySelector('input[name=site]:checked').value;
}
function isLive(p) {
  return publishMs(p) <= Date.now();
}

function postUrl(p, preview) {
  return `${SITES[siteOf(p)].blog}post?slug=${encodeURIComponent(p.slug)}${preview ? '&preview=1' : ''}`;
}

/* Data/hora local no formato do <input type="datetime-local">: 2026-10-27T14:05 */
function localInput(d = new Date()) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
function todayISO() {
  return localInput().slice(0, 10);
}
function fmtWhen(ms) {
  const v = localInput(new Date(ms));
  return `${fmtDate(v.slice(0, 10))}, ${v.slice(11)}`;
}
function fromNow(ms) {
  const min = Math.round((ms - Date.now()) / 60000);
  if (min < 60) return `em ${Math.max(min, 1)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `em ${h} h`;
  const d = Math.round(h / 24);
  return `em ${d} dia${d > 1 ? 's' : ''}`;
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
