# Publicação de posts no blog (área `/admin`)

Este guia ativa a página secreta **`/admin`**, onde a equipe da BAM publica,
agenda, edita e exclui artigos de qualquer lugar, com login. O mesmo painel
atende **dois blogs**: o da BAM Assessoria (este repositório) e o da BAM Tec
(repositório `BAMTEC`, site `bamtec` no mesmo projeto Firebase). Os artigos
antigos (escritos direto no código dos sites) continuam fixos e não são afetados.

> **Resumo da arquitetura**
> - Login: **Firebase Authentication** (e-mail + senha).
> - Conteúdo dos novos posts: **Cloud Firestore** (coleção `posts`), com o
>   campo `site` (`bam` ou `bamtec`) dizendo em qual blog o post sai.
> - Imagens de capa: **Firebase Storage** (pasta `blog/`).
> - `publishAt` diz quando o post entra no ar. Se a data estiver no futuro, o
>   post fica **programado**: os blogs o escondem até a hora chegar e ele entra
>   sozinho, sem servidor nem deploy (cada blog filtra ao montar a página).
> - Blog da BAM: `/blog/index.html` lê os posts com `site = bam` e os mostra
>   no topo; cada um abre em `/blog/post?slug=...` (`js/post-view.js`).
> - Blog da BAM Tec: `/blog/` e `/blog/post?slug=...` do site BAM Tec leem os
>   posts com `site = bamtec` pela API REST do Firestore (`js/blog-posts.js`
>   no repositório `BAMTEC`).
> - A página `/admin` **não** é linkada em lugar nenhum e tem `noindex`.

---

## 1. Pré-requisitos

- O site já usa **Firebase Hosting** (arquivo `firebase.json`), então o
  projeto Firebase já existe.
- Ter o **Firebase CLI** instalado (`npm install -g firebase-tools`) e estar
  logado (`firebase login`).

## 2. Habilitar os serviços no Console do Firebase

No [console.firebase.google.com](https://console.firebase.google.com), no projeto da BAM:

1. **Authentication** → *Get started* → aba *Sign-in method* → habilite
   **E-mail/senha**.
2. **Authentication** → aba *Users* → **Add user** → crie a conta de cada
   pessoa que vai publicar (ex.: `bam.assessoria@gmail.com` + senha forte).
   > ⚠️ Crie as contas **antes** de divulgar a URL `/admin`. A segurança
   > depende da lista de e-mails (passo 4) + dessas contas já existirem.
3. **Firestore Database** → *Create database* → modo *Production* → escolha a
   região (ex.: `southamerica-east1`).
4. **Storage** → *Get started* → *Production* → mesma região.

## 3. Colar a configuração Web no projeto

1. Console → ⚙ **Configurações do projeto** → aba *Geral* → seção *Seus apps*.
2. Se não houver um app Web, clique em **</>** e registre (sem precisar de Hosting de novo).
3. Copie o objeto `firebaseConfig` e cole em **`js/firebase-config.js`**,
   preenchendo `apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId` e `appId`.

Assim que esse arquivo é preenchido, o blog e a página `/admin` passam a
funcionar automaticamente.

## 4. Definir quem pode publicar (lista de e-mails)

Edite a lista `ADMINS` nos **dois** arquivos de regras, colocando os mesmos
e-mails que você criou no passo 2:

- `firestore.rules` → função `isAdmin()`
- `storage.rules` → função `isAdmin()`

```
request.auth.token.email in [
  'bam.assessoria@gmail.com',
  'outro-admin@bamassessoria.com'
]
```

## 5. Publicar as regras de segurança

Na raiz do projeto:

```bash
firebase deploy --only firestore:rules,storage
```

(Se o CLI pedir para selecionar o projeto: `firebase use --add`.)

## 6. Subir o site

```bash
# 1) regenerar as páginas estáticas
node tools/build.mjs       # (ou dois cliques em build.bat no Windows)

# 2) publicar o site
firebase deploy --only hosting
```

## 7. Usar

1. Acesse **`https://www.bamassessoria.com/admin/`** (ou `/admin`).
2. Faça login com um dos e-mails autorizados.
3. Escolha o blog (**BAM Assessoria** ou **BAM Tec**) e preencha título,
   **Publicar em** (data e hora), categoria (opcional), resumo, capa (opcional)
   e o conteúdo.
   - Data e hora de agora (o padrão) ou no passado → **Publicar artigo**: o
     post aparece no topo do blog na hora, com essa data.
   - Data no futuro → **Agendar artigo**: o post vai para **Programados** e
     entra no ar sozinho na hora marcada.
4. Na **Gestão do blog**, abaixo do formulário, ficam duas listas, com filtro
   por blog:
   - **Programados** (do mais próximo ao mais distante): **Prévia** abre o
     artigo com um aviso de pré-visualização (link com `&preview=1`),
     **Publicar agora** antecipa a publicação, **Editar** e **Excluir**.
   - **Publicados**: **Ver**, **Editar** e **Excluir**.
5. Ao editar um post que já está no ar, o endereço (slug) não muda, para não
   quebrar links compartilhados. Enquanto o post ainda está programado, o
   endereço acompanha o título. Mudar a data de um post publicado para o
   futuro tira ele do ar até lá (o painel pede confirmação).

---

## Perguntas frequentes

**A URL `/admin` é mesmo secreta?**
Ela não é linkada em nenhum menu, está com `noindex` (não aparece no Google) e
fica fora do `sitemap.xml`. Mas a proteção que realmente importa é o **login** +
a **lista de e-mails** nas regras — mesmo quem descobrir a URL não consegue
publicar sem uma conta autorizada. Se quiser, renomeie a pasta `admin/` para
algo menos óbvio (ex.: `painel-bam/`); o login continua funcionando igual.

**Quero esconder ainda mais.** Renomeie a pasta `admin/` e avise a equipe da
nova URL. Nenhum código depende do nome `admin`.

**Os posts antigos somem?** Não. Eles continuam como HTML estático em `/blog/`.
O painel só adiciona posts novos por cima.

**E o SEO dos posts novos?** Os posts do painel são renderizados no navegador
(não são HTML pré-gerado), então têm menos força de SEO que os antigos. Para um
artigo muito estratégico, vale gerar ele de forma estática (via `data/posts.json`
+ `build.mjs`) como os antigos.

**Um post programado é secreto até a hora?** Ele não aparece em nenhum blog,
lista ou busca do site, mas a coleção `posts` tem leitura pública nas regras
(é o que deixa os blogs lerem sem login). Quem conhecer o endereço com
`&preview=1`, ou consultar a API do Firestore direto, consegue ler o texto
antes da hora. Para um anúncio que não pode vazar, só agende quando o texto
puder ser lido; se isso virar exigência, o caminho é endurecer as regras
(`publishAt <= request.time` para quem não é admin).

**Esqueci a senha.** Console → Authentication → Users → menu do usuário →
*Reset password*.
