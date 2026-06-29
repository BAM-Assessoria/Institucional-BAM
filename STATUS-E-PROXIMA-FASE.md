# 📋 BAM Institucional — Status & Próxima Fase

> Atualizado em **2026-06-29** · branch `main` · último commit de código: **`cbb01a4`**
> Este arquivo está no `ignore` do Firebase Hosting — **não** vai pro ar, só pro repositório.

---

## ✅ O que foi feito nesta fase (já no GitHub / `main`)

Arquivos tocados: `index.html`, `css/styles.css`, `js/main.js`, `tools/build.mjs`.

1. **Marquee em loop infinito** — a faixa verde ("Estratégia ››› Tráfego Pago…") e a
   esteira de logos de clientes agora rodam **sem o "buraco verde"**. O keyframe `marq`
   passou a deslocar `-50%` e o `js/main.js` preenche a faixa até passar da largura da
   tela e monta 2 metades idênticas.
2. **Cases — só os 4 clientes reais**: Hygge Games, Prompt Serviços, Granitos Moredo e
   Novu. Removidos Tomazini, Pq. da Cantareira e Kontainers dos cards. Card da Novu
   criado (sem logo — usa foto + nome em texto). Grid passou a 2×2.
3. **Depoimentos completos** — 4 depoimentos com frase integral, nome, cargo, empresa,
   resultado destacado e foto correta de `depoimentos/`.
4. **Deck 3D do topo ("Cases que falam por si")** — mantido com o **portfólio completo**
   (9 peças), conforme pedido depois.
5. **Rodapé menor** — slogan "Juntos vamos mais longe" reduzido (156px → **72px**) e
   espaçamentos (padding do topo e gap das colunas) cortados.
6. **Blog** — **movido para depois do formulário de contato** e **reduzido**: deixou de
   ser seção `.scene` (ocupava 100vh / tela inteira) e virou `.flow` (altura do conteúdo);
   imagem do destaque limitada a 280px de altura; padding da seção menor.
7. **`tools/build.mjs`** — arrays `CASES`/`QUOTES` e templates atualizados para os 4
   clientes (espelhando o index.html).

---

## ⚠️ Pendências — o que falta

### 1. 🔴 Gerador `tools/build.mjs` está DEFASADO (prioridade alta)
- Ele **não contém** a seção do **deck 3D** nem a seção do **blog** (foram feitas à mão
  no `index.html`) e os logos divergem.
- **NÃO rode `node tools/build.mjs`** — ele regeneraria o `index.html` e **quebraria**
  (perderia o deck e o blog, e reverteria os logos reais).
- **Decisão necessária:** (a) **reconciliar** o gerador (portar deck + blog + logos reais
  pra dentro do build.mjs) ou (b) **aposentar** o gerador e tratar o `index.html` como
  fonte única da verdade.

### 2. Dados reais da Novu
- `case-sub` está com texto genérico: *"Parceira da BAM em estratégia e performance"* →
  trocar pelo **segmento real** da empresa.
- Não existe **logo** da Novu em `assets/img/clients/` (o card usa só a foto da pessoa).
- Não existe **arte/peça de portfólio** da Novu para o deck 3D.
- Métrica/ano do case ("ROI 50%", 2025) → **confirmar com a cliente**.

### 3. Métrica da Hygge (inconsistência a decidir)
- Card de case diz **"+200% Engajamento"**; o depoimento diz **"+400% de seguidores
  engajados"**. Decidir se alinha os dois números.

### 4. Esteira de logos (Clientes & Parcerias)
- Ainda lista **todos** os clientes (inclui Tomazini, Kontainers, Cemitério Cantareira
  etc.), diferente dos cards. Confirmar se é proposital (esteira = todos / cards = 4 reais).

### 5. 🚀 Deploy — NÃO está no ar ainda
- O push foi só pro **GitHub**. **Não há GitHub Actions**, então não sobe sozinho.
- Site usa **Firebase Hosting** (projeto `bam-site-fb9d5`, `public: "."`).
- Para publicar: `npx firebase deploy --only hosting`.

### 6. QA responsivo (mobile/tablet)
- As mudanças (cases 2×2, depoimentos 2×2, blog como `.flow`, rodapé) foram afinadas pro
  **desktop**. Falta testar/ajustar em **mobile e tablet**.

### 7. Posição do blog
- Ficou **depois do CTA final** ("Vamos crescer juntos?"). Avaliar se enfraquece o CTA —
  é fácil mover de volta pra cima (ou pra outro ponto) se preferir.

---

## 📌 Notas técnicas
- `js/deck.js` se **auto-centraliza** para qualquer número de cards — **não tem mais**
  os arrays `FAN`/`STACK` (a observação do prompt original estava desatualizada).
- **Fonte da verdade hoje = `index.html`** (não o gerador).
- Para puxar tudo amanhã: `git pull` (commit de código `cbb01a4` + este relatório).

---

## 🧩 Prompt pronto para a próxima fase (copiar e colar)

```
Contexto: site estático da BAM (index.html + css/styles.css + js/). O index.html é a
FONTE DA VERDADE; o gerador tools/build.mjs está DEFASADO (não tem deck nem blog) —
NÃO rode `node tools/build.mjs` sem reconciliar antes.

Antes de começar: git pull (pegar o commit cbb01a4 e o STATUS-E-PROXIMA-FASE.md).

Tarefas da próxima fase:
1. [build.mjs] Decidir e executar: reconciliar o gerador (portar deck 3D + seção de blog
   + logos reais pra dentro do build.mjs, espelhando o index.html atual, de modo que
   `node tools/build.mjs` reproduza o index.html sem quebrar) OU aposentar o gerador.
2. [Novu] Preencher dados reais: segmento (case-sub), logo em assets/img/clients/, arte
   de portfólio pro deck 3D e confirmar métrica/ano do case.
3. [Hygge] Alinhar (ou não) a métrica do card (+200%) com a do depoimento (+400%).
4. [Esteira de logos] Confirmar se mantém todos os clientes ou só os 4 reais.
5. [Responsivo] Testar e ajustar mobile/tablet das seções alteradas (cases, depoimentos,
   blog, rodapé, marquee).
6. [Deploy] Publicar no Firebase Hosting (projeto bam-site-fb9d5):
   `npx firebase deploy --only hosting`.
```
