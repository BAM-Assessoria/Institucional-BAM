// Verifica se todos os href/src locais das páginas geradas apontam para arquivos existentes.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const pages = ['index.html', 'sobre.html', 'contato.html', 'privacidade.html', 'portifolio.html'];
if (existsSync('servicos')) for (const f of readdirSync('servicos')) if (f.endsWith('.html')) pages.push('servicos/' + f);
if (existsSync('blog')) for (const f of readdirSync('blog')) if (f.endsWith('.html')) pages.push('blog/' + f);

const skip = (u) => /^(https?:|\/\/|mailto:|tel:|data:|javascript:|#)/.test(u);
let checked = 0, missing = [];

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const base = dirname(page);
  const re = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    let u = m[1];
    if (skip(u)) continue;
    u = u.split('#')[0].split('?')[0];
    if (!u) continue;
    checked++;
    // URLs limpas (sem .html): /sobre -> sobre.html, blog/ -> blog/index.html.
    const target = resolve(base, u);
    const ok = existsSync(target) && (!u.endsWith('/') || existsSync(resolve(target, 'index.html')))
      || existsSync(target + '.html');
    if (!ok) missing.push(`${page} -> ${m[1]}`);
  }
}

console.log(`Páginas: ${pages.length} | refs locais checadas: ${checked}`);
if (missing.length) { console.log(`\n❌ ${missing.length} REFERÊNCIAS QUEBRADAS:`); [...new Set(missing)].forEach(x => console.log(' - ' + x)); process.exit(1); }
else console.log('✅ Nenhuma referência local quebrada.');
