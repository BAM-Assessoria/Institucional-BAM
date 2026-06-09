# BAM Assessoria — Site Institucional

Site institucional estático da **BAM Assessoria em Marketing**, multi-página, sem
dependências externas de imagens (tudo hospedado localmente) e com foco em
performance, SEO e segurança.

---

## 📂 Estrutura

```
site bam/
├── index.html              ← Início (hero, cases, serviços, clientes, contato)
├── sobre.html              ← Sobre (história, missão/visão/valores, time)
├── blog/
│   ├── index.html          ← Listagem do blog (com busca)
│   └── <slug>.html         ← 48 artigos do blog
├── privacidade.html        ← Política de Privacidade (LGPD)
├── css/styles.css          ← TODO o estilo do site
├── js/main.js              ← TODO o JavaScript (modular, com guardas)
├── assets/
│   ├── svg/                ← logos da marca (ícone + wordmark)
│   └── img/
│       ├── clients/        ← 24 logos de clientes (WebP)
│       ├── team/           ← 10 fotos da equipe (WebP)
│       └── blog/           ← capas dos posts (WebP)
├── data/                   ← CONTEÚDO (fonte da verdade do gerador)
│   ├── posts.json          ← os 48 posts do blog
│   ├── team.json           ← equipe
│   └── clients.json        ← lista de logos
├── tools/                  ← scripts de geração (Node.js)
├── sitemap.xml · robots.txt
├── _headers · .htaccess    ← cabeçalhos de segurança (por host)
└── build.bat               ← regenerar o site com 2 cliques (Windows)
```

## 👀 Ver o site

Basta **abrir `index.html`** no navegador (duplo-clique). Funciona offline.
Para algo mais próximo de produção, sirva a pasta com um servidor local:

```bash
npx serve .        # ou: python -m http.server
```

## ✏️ Editar conteúdo

O site é **gerado** a partir do conteúdo em `data/` e dos modelos em `tools/build.mjs`.
Depois de qualquer alteração, **regenere** rodando `build.bat` (ou `node tools/build.mjs`).

- **Textos das páginas Início/Sobre/Privacidade:** editar as funções correspondentes
  em `tools/build.mjs` (`buildHome`, `buildSobre`, `buildPrivacidade`).
- **Posts do blog:** editar `data/posts.json` (título, data, categoria, `excerpt`,
  `bodyHtml`). Para um post novo, copie um objeto existente, troque o `slug`
  (sem acento, em minúsculas) e o conteúdo.
- **Equipe / clientes:** `data/team.json` e `data/clients.json`.

> ⚠️ Sempre rode `build.bat` após editar — senão os `.html` não mudam.

## 🚀 Publicar (deploy)

É um site estático: as páginas já são HTML pronto. **Não precisa "buildar" para publicar** —
o `build.bat` só é necessário quando você edita o conteúdo e quer regerar os `.html`.

- **Firebase Hosting (recomendado aqui):** já existe um `firebase.json` configurado
  (raiz como `public`, ignorando `tools/`/`data/`, com headers de segurança e cache).
  Basta ter o projeto vinculado e rodar:
  ```bash
  firebase deploy --only hosting
  ```
  Se ainda não vinculou um projeto: `firebase login` e depois `firebase use --add` (ou
  `firebase init hosting` — ao ser perguntado, mantenha este `firebase.json`).
- **Netlify / Vercel / Cloudflare Pages:** arraste a pasta (o `_headers` aplica segurança).
- **Hospedagem comum (cPanel/Apache):** envie os arquivos para `public_html` (o `.htaccess` aplica segurança/cache).
- **GitHub Pages:** publique a pasta na branch configurada.

> No Firebase, os arquivos `_headers` e `.htaccess` são ignorados (são de outros hosts) —
> a segurança vem do `firebase.json`. A CSP continua em cada página (via `<meta>`).

## ⚡ Performance

- Imagens convertidas de PNG para **WebP** (economia de ~95% — de ~5,7 MB para ~250 KB).
- CSS e JS externos (cacheáveis), sem código repetido inline.
- Logos da marca como **SVG** reaproveitados (antes eram base64 gigante repetido 9×).
- Fontes com `display=swap` e `preconnect`.
- `loading="lazy"` + `decoding="async"` nas imagens; dimensões definidas (evita layout shift).

## 🔒 Segurança

- **Content-Security-Policy** por página (via `<meta>`, com hash do JSON-LD).
- `Referrer-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`
  via `_headers` (Netlify/Cloudflare) e `.htaccess` (Apache).
- Links externos com `rel="noopener noreferrer"`.
- HTML dos posts sanitizado (sem `<script>`/handlers `on*`).
- O formulário não envia dados a servidores: monta uma mensagem e abre o WhatsApp.

## 🛠️ Scripts (pasta `tools/`)

| Script | Função |
|---|---|
| `build.mjs` | **Gera todas as páginas** + `sitemap.xml` + `robots.txt`. É o que o `build.bat` executa. |
| `check-links.mjs` | Verifica se há links/imagens locais quebrados (rode após editar). |

Requisito: **Node.js 18+**.

> Os scripts de coleta e otimização de imagens (download do Wix, conversão para WebP,
> consolidação dos posts) já cumpriram sua função e foram removidos — o conteúdo final
> já está salvo em `data/*.json` e `assets/`.
