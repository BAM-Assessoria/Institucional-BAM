/* =============================================================
   BAM Assessoria — inicialização única do Firebase + App Check
   -------------------------------------------------------------
   Todo cliente Firebase do site (blog, visualizador de post,
   formulário das landing pages e painel /admin) passa por aqui.

   Por que centralizar: com o App Check EXIGIDO no console, uma
   requisição sem token é recusada. Se um único cliente inicializar
   o app por conta própria, ele para de funcionar. Um ponto único
   garante que os quatro peguem o token do mesmo jeito.

   O App Check só liga quando `recaptchaSiteKey` está preenchida em
   firebase-config.js. Enquanto estiver vazia, tudo continua
   funcionando — sem proteção, mas sem quebrar.
   ============================================================= */
import { firebaseConfig, firebaseReady, recaptchaSiteKey, appCheckReady, SDK } from './firebase-config.js';

let bootPromise = null;

/* Devolve sempre a MESMA instância do app, com App Check já ativo.
   Chamar várias vezes é seguro: a promessa é reaproveitada. */
export function boot() {
  if (!firebaseReady) return Promise.reject(new Error('Firebase não configurado'));
  if (!bootPromise) bootPromise = start();
  return bootPromise;
}

async function start() {
  const { initializeApp, getApps, getApp } = await import(`${SDK}/firebase-app.js`);
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  if (appCheckReady) {
    const { initializeAppCheck, ReCaptchaV3Provider } = await import(`${SDK}/firebase-app-check.js`);
    // isTokenAutoRefreshEnabled: renova o token sozinho enquanto a aba
    // estiver aberta — sem isso, uma sessão longa no /admin começaria a
    // receber recusa depois que o primeiro token expira.
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } else {
    console.warn('[BAM] App Check desligado: preencha recaptchaSiteKey em js/firebase-config.js');
  }

  return app;
}

/* Atalho: app + módulo do Firestore, que é o par mais usado no site. */
export async function bootFirestore() {
  const app = await boot();
  const fs = await import(`${SDK}/firebase-firestore.js`);
  return { app, fs, db: fs.getFirestore(app) };
}
