/* =============================================================
   BAM Assessoria — Configuração do Firebase (blog dinâmico + admin)
   -------------------------------------------------------------
   COMO PREENCHER:
   1. Acesse https://console.firebase.google.com e abra o projeto da BAM.
   2. Vá em  ⚙  Configurações do projeto → aba "Geral" → seção "Seus apps".
   3. Se ainda não existir um app Web, clique em "</>" e registre um.
   4. Copie os valores do objeto firebaseConfig e cole abaixo.

   Estes valores NÃO são segredo (a config Web do Firebase é pública por
   design). A segurança real fica nas Regras do Firestore/Storage — veja o
   arquivo SETUP-BLOG.md na raiz do projeto.
   ============================================================= */
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

/* Versão do SDK do Firebase carregada via CDN (gstatic). */
export const SDK = 'https://www.gstatic.com/firebasejs/10.12.0';

/* Detecta automaticamente se a configuração já foi preenchida. */
export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
