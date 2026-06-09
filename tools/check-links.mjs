// Verifica se todos os href/src locais das páginas geradas apontam para arquivos existentes.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const pages = ['index.html', 'sobre.html', 'privacidade.html'];
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
    const target = resolve(base, u);
    if (!existsSync(target)) missing.push(`${page} -> ${m[1]}`);
  }
}

console.log(`Páginas: ${pages.length} | refs locais checadas: ${checked}`);
if (missing.length) { console.log(`\n❌ ${missing.length} REFERÊNCIAS QUEBRADAS:`); [...new Set(missing)].forEach(x => console.log(' - ' + x)); process.exit(1); }
else console.log('✅ Nenhuma referência local quebrada.');
