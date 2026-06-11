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
  apiKey: "AIzaSyAzdDXiC11hS8JMooPy5-I9me17qFUUfO4",
  authDomain: "bam-site-fb9d5.firebaseapp.com",
  projectId: "bam-site-fb9d5",
  storageBucket: "bam-site-fb9d5.firebasestorage.app",
  messagingSenderId: "76027723304",
  appId: "1:76027723304:web:31ed49248be580f4a83f1d",
  measurementId: "G-9RVWN6ZG08",
};

/* Versão do SDK do Firebase carregada via CDN (gstatic). */
export const SDK = 'https://www.gstatic.com/firebasejs/10.12.0';

/* Detecta automaticamente se a configuração já foi preenchida. */
export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
