/* =============================================================
   BAM Assessoria — consentimento de cookies + Google Analytics 4
   -------------------------------------------------------------
   Regra que governa este arquivo: nenhum cookie de medição é
   gravado antes do aceite explícito. É o que a LGPD pede para
   cookies não essenciais — e é coerente com o que o próprio blog
   da BAM defende no artigo sobre LGPD na obtenção de leads.

   Como funciona:
   1. Em toda página, o Consent Mode v2 é declarado como NEGADO.
      Isso acontece sem rede: são só chamadas empilhadas no
      dataLayer, nenhum script do Google é baixado ainda.
   2. Se não houver decisão salva, o banner aparece.
   3. No "Aceitar", o consentimento é atualizado para concedido e
      só ENTÃO o gtag.js é baixado e o GA4 configurado.
   4. No "Recusar", nada é carregado. A escolha fica salva e o
      banner não volta a incomodar.

   A decisão pode ser trocada depois pelo link "Cookies" do rodapé
   (qualquer elemento com [data-cookies]).
   ============================================================= */
import { firebaseConfig } from './firebase-config.js';

const KEY = 'bam:consent';           // 'granted' | 'denied'
const GA_ID = firebaseConfig.measurementId || '';

/* ---------- Consent Mode v2: nega tudo por padrão ---------- */
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
window.gtag = window.gtag || gtag;

gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'granted',   // essencial (preferência do próprio banner)
  security_storage: 'granted',
});

const saved = read();
if (saved === 'granted') enable();
else if (saved !== 'denied') showBanner();

// Permite reabrir a escolha a partir do rodapé.
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-cookies]');
  if (!el) return;
  e.preventDefault();
  showBanner(true);
});

/* ---------- armazenamento ---------- */
function read() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function write(v) {
  try { localStorage.setItem(KEY, v); } catch { /* modo privado: decisão vale só nesta sessão */ }
}

/* ---------- liga o GA4 ---------- */
function enable() {
  gtag('consent', 'update', {
    ad_storage: 'denied',            // não usamos anúncios/remarketing hoje
    analytics_storage: 'granted',
  });
  if (!GA_ID || window.__bamGA) return;
  window.__bamGA = true;

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
  document.head.appendChild(s);

  gtag('js', new Date());
  gtag('config', GA_ID, { anonymize_ip: true });
}

function disable() {
  gtag('consent', 'update', { ad_storage: 'denied', analytics_storage: 'denied' });
}

/* ---------- banner ---------- */
function showBanner(reopen = false) {
  if (document.getElementById('bamConsent')) return;

  const el = document.createElement('div');
  el.id = 'bamConsent';
  el.className = 'ck';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-label', 'Aviso de cookies');
  el.innerHTML = `
    <div class="ck-in">
      <p class="ck-txt"><strong>Cookies de medição.</strong> Usamos o Google Analytics para entender
      quais conteúdos são úteis e melhorar o site. Nada é gravado antes do seu aceite, e você pode
      mudar de ideia quando quiser. <a href="${privacyHref()}">Política de Privacidade</a>.</p>
      <div class="ck-btns">
        <button type="button" class="ck-no" id="ckNo">Recusar</button>
        <button type="button" class="ck-yes" id="ckYes">Aceitar</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add('ck-open');   // afasta o botão do WhatsApp
  requestAnimationFrame(() => el.classList.add('on'));

  el.querySelector('#ckYes').addEventListener('click', () => { write('granted'); enable(); close(el); });
  el.querySelector('#ckNo').addEventListener('click', () => { write('denied'); disable(); close(el); });
  if (reopen) el.querySelector('#ckYes').focus();
}

function close(el) {
  el.classList.remove('on');
  document.body.classList.remove('ck-open');
  setTimeout(() => el.remove(), 320);
}

/* A política está na raiz; daqui o caminho depende da profundidade da página. */
function privacyHref() {
  const depth = location.pathname.replace(/\/[^/]*$/, '/').split('/').filter(Boolean).length;
  return '../'.repeat(depth) + 'privacidade.html';
}

/* ---------- API para o resto do site ---------- */
/* Dispara um evento no GA4 apenas se houver consentimento. Usado, por
   exemplo, na conversão do formulário das landing pages. */
export function track(name, params = {}) {
  if (read() !== 'granted' || !window.__bamGA) return;
  window.gtag('event', name, params);
}
