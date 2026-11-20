// Keeps the "Now", "Latest papers" and "In the news" sections of README.md in step with the CV:
// reads profile.js from the Dossier repo (the single source of CV data) and rewrites the text between the markers.
// Run by .github/workflows/sync-readme.yml every day; locally: node scripts/sync-readme.mjs [path/to/profile.js]
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = process.argv[2] || 'https://raw.githubusercontent.com/Bharat-Singh-Rawat/Dossier/main/profile.js';
const code = SRC.startsWith('http') ? await (await fetch(SRC)).text() : fs.readFileSync(SRC, 'utf8');
const ctx = { window: {}, document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }, console };
vm.runInNewContext(code, ctx);
const P = ctx.window.PROFILE;
if (!P) throw new Error('PROFILE not found in ' + SRC);

const clean = s => String(s ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const month = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

// Now: the current role and what it involves
const e = (P.experience || [])[0];
const now = e ? [
    `**${clean(e.role)}** · ${clean(e.org)} · <sub>${clean(e.dates)}</sub>`,
    '',
    ...(e.bullets || []).slice(0, 2).map(b => `- ${clean(b)}`)
].join('\n') : '';

// Latest papers: the five newest, each with its DOI
const papers = (P.publications || []).slice(0, 5).map(p =>
    `- **${clean(p.title).replace(/\.$/, '')}** · *${clean(p.venue)}*${p.doi ? ` · [doi](https://doi.org/${p.doi})` : ''}${p.badge ? ` · 🏆 ${clean(p.badge)}` : ''}`
).join('\n');

// In the news: the three newest stories
const news = [...(P.news || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(n =>
    `- [${clean(n.title)}](${n.url}) · <sub>${clean(n.source)}, ${month(n.date)}</sub>`
).join('\n');

const file = new URL('../README.md', import.meta.url);
let md = fs.readFileSync(file, 'utf8');
const put = (key, body) => {
    const re = new RegExp(`(<!-- ${key}:START -->)[\\s\\S]*?(<!-- ${key}:END -->)`);
    if (!re.test(md)) throw new Error('markers missing for ' + key);
    md = md.replace(re, `$1\n${body}\n$2`);
};
put('NOW', now); put('PAPERS', papers); put('NEWS', news);
const before = fs.readFileSync(file, 'utf8');
if (md !== before) { fs.writeFileSync(file, md); console.log('README updated'); } else console.log('README already up to date');
