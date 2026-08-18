/* =============================================================
   BAM Assessoria — formulário das landing pages de material rico
   -------------------------------------------------------------
   Grava o lead na coleção "leads" do Firestore e libera o download
   do material na hora, sem sair da página.

   Decisões que valem explicar:
   - O download NÃO depende do Firestore. Se a gravação falhar, a
     pessoa recebe o material do mesmo jeito (ela cumpriu a parte
     dela) e a página oferece o WhatsApp como caminho alternativo.
     Segurar o material por erro nosso só custa reputação.
   - Consentimento LGPD é obrigatório: sem o checkbox marcado o
     documento nem chega a ser montado — e a regra do Firestore
     recusa `consentimento != true`, então a validação existe dos
     dois lados.
   - `createdAt` usa serverTimestamp(): a regra exige que ele seja
     igual a request.time, então a data não pode ser forjada.

   Requisitos da página que usa este módulo:
   - ter sido gerada com `firebase: true` (a CSP precisa liberar
     gstatic + firestore.googleapis.com);
   - conter #lpForm, #lpDone, #lpErr e #lpDownload.
   ============================================================= */
import { firebaseReady } from './firebase-config.js';
import { bootFirestore } from './firebase-boot.js';
import { track } from './consent.js';

const form = document.getElementById('lpForm');
if (form) init();

function init() {
  const done = document.getElementById('lpDone');
  const errBox = document.getElementById('lpErr');
  const btn = form.querySelector('button[type="submit"]');
  const tel = form.querySelector('#lpTelefone');
  const openedAt = Date.now();

  // Máscara de telefone: (11) 9 8888-7777 / (11) 3333-4444.
  if (tel) {
    tel.addEventListener('input', () => {
      const d = tel.value.replace(/\D/g, '').slice(0, 11);
      let v = d;
      if (d.length > 10) v = `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
      else if (d.length > 6) v = `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      else if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      else if (d.length) v = `(${d}`;
      tel.value = v;
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.remove('on');

    // Robô de formulário: preenche tudo, inclusive o campo escondido,
    // e costuma enviar em menos de 2s. Nos dois casos, sai calado.
    if (form.querySelector('#lpSite').value) return reveal();
    if (Date.now() - openedAt < 1800) return reveal();

    const data = {
      nome: form.querySelector('#lpNome').value.trim().slice(0, 80),
      email: form.querySelector('#lpEmail').value.trim().toLowerCase().slice(0, 120),
      telefone: form.querySelector('#lpTelefone').value.trim().slice(0, 20),
      empresa: form.querySelector('#lpEmpresa').value.trim().slice(0, 80),
      consentimento: form.querySelector('#lpConsent').checked,
      origem: origem(),
      // qual material gerou o lead — o dia que existir um segundo ebook,
      // é isso que separa uma lista da outra.
      material: (form.dataset.material || 'material').slice(0, 60),
    };
    if (!data.consentimento) {
      return fail('É preciso concordar com o uso dos seus dados para receber o material.');
    }

    const old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Enviando...</span>';
    try {
      await save(data);
    } catch (e2) {
      // Não bloqueia a entrega: registra o problema e segue.
      console.warn('[BAM] Lead não registrado:', e2);
      errBox.innerHTML = 'Não conseguimos registrar seu contato agora, mas o material está liberado abaixo. '
        + 'Se quiser falar com a gente, chame no <a href="https://api.whatsapp.com/send/?phone=5511976259165" '
        + 'target="_blank" rel="noopener noreferrer">WhatsApp</a>.';
      errBox.classList.add('on');
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
    reveal();
  });

  function fail(msg) {
    errBox.textContent = msg;
    errBox.classList.add('on');
  }

  // Troca o formulário pelo painel de download e leva o olho até ele.
  function reveal() {
    // Conversão no GA4. Só dispara se houver consentimento de cookies —
    // quem recusou não é medido, e isso é intencional.
    track('generate_lead', {
      material: form.dataset.material || 'material',
      origem: origem(),
    });
    form.style.display = 'none';
    const head = document.getElementById('lpCardHead');
    if (head) head.style.display = 'none';
    done.classList.add('on');
    done.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/* De onde veio o lead: prioriza UTM, cai para o domínio de origem. */
function origem() {
  const q = new URLSearchParams(location.search);
  const utm = q.get('utm_source') || q.get('origem');
  if (utm) return utm.slice(0, 40);
  if (!document.referrer) return 'direto';
  try {
    const h = new URL(document.referrer).hostname.replace(/^www\./, '');
    return (h === location.hostname.replace(/^www\./, '') ? 'site' : h).slice(0, 40);
  } catch { return 'direto'; }
}

async function save(data) {
  if (!firebaseReady) throw new Error('Firebase não configurado');
  const { fs, db } = await bootFirestore();
  const { collection, addDoc, serverTimestamp } = fs;

  // O shape aqui tem que bater exatamente com hasOnly() em firestore.rules.
  await addDoc(collection(db, 'leads'), {
    nome: data.nome,
    email: data.email,
    telefone: data.telefone,
    empresa: data.empresa,
    consentimento: true,
    origem: data.origem,
    material: data.material,
    createdAt: serverTimestamp(),
  });
}
