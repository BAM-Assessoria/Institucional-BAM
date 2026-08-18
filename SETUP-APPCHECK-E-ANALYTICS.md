# App Check (reCAPTCHA v3) e Google Analytics 4

Dois assuntos independentes, ambos já implementados no código. O que falta é
configuração no console — e a **ordem importa**, principalmente no App Check.

---

# Parte 1 — App Check com reCAPTCHA v3

## O que isso resolve

A `apiKey` e o `projectId` do Firebase são públicos por design (estão em
`js/firebase-config.js`, visíveis no navegador). Sem App Check, qualquer pessoa
pode gravar leads direto na API REST do Firestore, em looping, sem nunca abrir a
landing page. As regras de segurança limitam o **formato** do documento, não o
**volume**.

O App Check exige que toda requisição traga um token emitido pelo reCAPTCHA v3,
que só é gerado num navegador real carregando o seu site.

## ⚠️ A ordem que evita derrubar o site

Quatro partes do site falam com o Firebase:

| Cliente | O que faz | Quebra se faltar token? |
|---|---|---|
| `js/blog-feed.js` | posts dinâmicos no topo do blog | sim |
| `js/post-view.js` | `/blog/post.html?slug=…` | sim |
| `js/lp-ebook.js` | formulário das landing pages | sim |
| `admin/admin.js` | painel de publicação | sim — inclusive o login |

Os quatro já passam por `js/firebase-boot.js`, que inicializa o App Check num
lugar só. Mas o token só existe **depois** que a chave do reCAPTCHA estiver
preenchida e o site publicado. Por isso:

> **Publique o site com a chave preenchida ANTES de ligar a exigência no
> console.** Se ligar a exigência primeiro, o blog dinâmico e o `/admin` param
> de funcionar até você desligar de novo.

## Passo a passo

### 1. Registrar o app no App Check

1. [console.firebase.google.com](https://console.firebase.google.com) → projeto
   **bam-site-fb9d5**.
2. Menu lateral → **Criação** → **App Check**.
3. Aba **Apps** → clique no app **Web** → **Registrar**.
4. Escolha o provedor **reCAPTCHA v3**.
5. O console abre o cadastro do reCAPTCHA. Informe os domínios:
   - `www.bamassessoria.com`
   - `bamassessoria.com`
   - `bam-site-fb9d5.web.app` (domínio do Firebase Hosting)
   - `localhost` — só se você quiser testar na sua máquina
6. Copie a **chave do site** (site key).

> A chave do site é pública, pode ficar no repositório. Quem não pode vazar é a
> chave secreta, que fica só no console.

### 2. Colar a chave no projeto

Em `js/firebase-config.js`:

```js
export const recaptchaSiteKey = 'COLE_A_CHAVE_DO_SITE_AQUI';
```

Enquanto essa string estiver vazia, o App Check fica desligado e o site funciona
normalmente (sem proteção). O console do navegador avisa:
`[BAM] App Check desligado: preencha recaptchaSiteKey`.

### 3. Publicar

```bash
node tools/build.mjs
npx firebase-tools deploy --only hosting
```

### 4. Conferir se os tokens estão chegando

No console → **App Check** → aba **APIs** → **Cloud Firestore**. Abra o site em
produção, navegue pelo blog, entre no `/admin` e envie o formulário da landing
page. Em alguns minutos o gráfico deve mostrar requisições **verificadas**.

**Só avance quando o gráfico mostrar verificadas e praticamente nenhuma
"não verificada" vinda de você.**

### 5. Ligar a exigência

Console → **App Check** → aba **APIs** → **Cloud Firestore** → **Aplicar**.
Faça o mesmo para o **Cloud Storage** (as capas dos posts do `/admin`).

Se algo quebrar, o botão **Cancelar aplicação** desfaz na hora.

### Testar na sua máquina depois de aplicar

Com a exigência ligada, `localhost` para de funcionar. Para voltar a testar
local: console → App Check → app Web → menu ⋮ → **Gerenciar tokens de
depuração**. No navegador, abra o console e rode
`self.FIREBASE_APPCHECK_DEBUG_TOKEN = true`, recarregue, copie o token que
aparece no console e cadastre-o no Firebase.

---

# Parte 2 — Google Analytics 4

## O que já está pronto

- A propriedade GA4 **já existe** (`G-9RVWN6ZG08`, criada junto com o projeto
  Firebase). Está lida automaticamente de `js/firebase-config.js`.
- `js/consent.js` está em **todas as 63 páginas públicas** — as 56 geradas pelo
  build e as 7 escritas à mão (`portifolio.html` e `servicos/*.html`).
- O painel `/admin` ficou **de fora de propósito**: é interno, tem `noindex`, e
  medir o uso do próprio time não serve para nada.
- A CSP de todas as páginas já libera os domínios do Google Analytics.

**Não há nada a configurar para o GA4 começar a receber dados.** Basta publicar.

## Como o consentimento funciona

Nenhum cookie de medição é criado antes do aceite:

1. Em toda página, o **Consent Mode v2** é declarado como negado. Isso não faz
   requisição nenhuma — são chamadas empilhadas no `dataLayer`.
2. Sem decisão salva, aparece o banner no rodapé.
3. **Aceitar** → consentimento atualizado e só então o `gtag.js` é baixado.
4. **Recusar** → nada é carregado, e a escolha é lembrada.
5. O link **"Cookies"** no rodapé de qualquer página reabre a escolha.

A decisão fica em `localStorage` na chave `bam:consent`.

## Conversão da landing page

Quando alguém completa o formulário do e-book, dispara o evento
`generate_lead` com os parâmetros `material` e `origem`.

Para transformá-lo em conversão no GA4: **Administrador** → **Eventos** →
localize `generate_lead` → ative **Marcar como evento principal**. O evento só
aparece na lista depois de ocorrer pelo menos uma vez.

> Quem recusou cookies não é medido. Isso significa que o número de conversões
> no GA4 será **menor** que o número real de leads no Firestore. O Firestore é a
> fonte da verdade para contagem de leads; o GA4 serve para entender origem e
> comportamento.

## O que mudou na política de privacidade

`privacidade.html` afirmava que o site **não utilizava cookies de rastreamento**.
Isso deixou de ser verdade, então o texto foi reescrito (a página é gerada por
`tools/build.mjs`, função `buildPrivacidade`):

- Nova seção **"5. Cookies e sua escolha"**, com as duas categorias usadas.
- Item novo sobre os dados coletados nos materiais gratuitos.
- Menção ao reCAPTCHA entre os recursos de terceiros.
- Data da última atualização: agosto de 2026.

---

# Resumo do que fazer

| # | Ação | Onde |
|---|---|---|
| 1 | Registrar o app no App Check com reCAPTCHA v3 | Console Firebase |
| 2 | Colar a chave em `recaptchaSiteKey` | `js/firebase-config.js` |
| 3 | `node tools/build.mjs` | terminal |
| 4 | `npx firebase-tools deploy --only firestore:rules` | terminal |
| 5 | `npx firebase-tools deploy --only hosting` | terminal |
| 6 | Navegar no site e conferir tokens verificados | Console → App Check |
| 7 | Ligar a exigência no Firestore e no Storage | Console → App Check |
| 8 | Marcar `generate_lead` como evento principal | Console GA4 |
