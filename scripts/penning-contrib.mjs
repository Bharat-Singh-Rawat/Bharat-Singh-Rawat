// Penning-trap contribution graph: the last year of GitHub contributions as an annihilation detector.
// Each day is a scintillator cell (shade = that day's contribution level). Under the grid an antiproton bunch drifts
// along a Penning trap through the year; at every week with contributions it annihilates, tracks curl up to that
// week's active days and their cells flash. Pure SVG + CSS animation (plays on GitHub), regenerated daily by
// .github/workflows/penning-contrib.yml. Locally: GH_TOKEN=$(gh auth token) node scripts/penning-contrib.mjs
import fs from 'node:fs';

const USER = process.env.GH_USER || 'Bharat-Singh-Rawat';
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) throw new Error('GH_TOKEN or GITHUB_TOKEN is needed to read the contribution calendar');
const q = `query($u:String!){ user(login:$u){ contributionsCollection{ contributionCalendar{ totalContributions
    weeks{ contributionDays{ date weekday contributionCount contributionLevel } } } } } }`;
const res = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'penning-contrib' }, body: JSON.stringify({ query: q, variables: { u: USER } }) });
const json = await res.json();
if (!json.data) throw new Error(JSON.stringify(json));
const cal = json.data.user.contributionsCollection.contributionCalendar;
const weeks = cal.weeks;

// deterministic randomness, so the picture only changes when the contributions do
let seed = 1;
for (const w of weeks) for (const d of w.contributionDays) seed = (seed * 31 + d.contributionCount + 7) % 2147483647;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const W = 900, H = 262, CELL = 12, GAP = 3, STEP = CELL + GAP, GX = 52, GY = 34;
const TRAP_Y = 196, LOOP = 36, SWEEP0 = 3.5, SWEEP1 = 32.5;
const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
const PAL = {
    dark: { bg: '#0d1117', ink: '#e6edf3', muted: '#7d8590', cells: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'], flash: '#eaffef',
        tube: '#21262d', tubeLine: '#30363d', gold: '#e3b341', coil: 'rgba(139,148,158,0.10)', coilLine: 'rgba(139,148,158,0.35)', pbar: '#dbe4ff', glow: '#9fb4ff' },
    light: { bg: '#ffffff', ink: '#1f2328', muted: '#656d76', cells: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'], flash: '#d7ff5c',
        tube: '#f6f8fa', tubeLine: '#d0d7de', gold: '#bf8700', coil: 'rgba(87,96,106,0.06)', coilLine: 'rgba(87,96,106,0.28)', pbar: '#4c6ef5', glow: '#748ffc' }
};
const TRACK = [['#ff9f0a', 'π'], ['#bf5af2', 'μ'], ['#64d2ff', 'e']];
const xOfWeek = w => GX + w * STEP + CELL / 2;
const pct = t => (100 * t / LOOP).toFixed(3) + '%';
const f = n => n.toFixed(1);

function build(theme) {
    const P = PAL[theme], out = [];
    const tracks = [], cells = [], booms = [];
    weeks.forEach((wk, wi) => {
        const vx = xOfWeek(wi), t0 = SWEEP0 + (SWEEP1 - SWEEP0) * wi / Math.max(1, weeks.length - 1);
        let any = false;
        wk.contributionDays.forEach(d => {
            const cx = GX + wi * STEP, cy = GY + d.weekday * STEP, lvl = LEVEL[d.contributionLevel] || 0;
            const hit = d.contributionCount > 0, t = t0 + d.weekday * 0.07;
            cells.push({ cx, cy, lvl, hit, t, date: d.date, n: d.contributionCount });
            if (!hit) return;
            any = true;
            const nTr = Math.min(3, 1 + Math.floor(d.contributionCount / 4));
            for (let k = 0; k < nTr; k++) {
                const [col] = TRACK[Math.floor(rnd() * TRACK.length)];
                const ex = cx + CELL / 2, ey = cy + CELL / 2, sx = vx + (rnd() - 0.5) * 6, sy = TRAP_Y - 9;
                const bend = (rnd() < 0.5 ? -1 : 1) * (18 + rnd() * 40);          // curl in the trap's magnetic field
                const mx = (sx + ex) / 2 + bend, my = (sy + ey) / 2;
                const len = Math.hypot(ex - sx, ey - sy) * 1.12 + Math.abs(bend) * 0.6;
                tracks.push({ d: `M${f(sx)} ${f(sy)} Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`, col, len, t: t - 0.12 });
            }
        });
        if (any) {
            booms.push({ x: vx, t: t0 - 0.15 });
            // a stray photon or two flying off (dashed, not detected)
            for (let k = 0; k < 1 + Math.floor(rnd() * 2); k++) {
                const a = Math.PI * (0.1 + 0.8 * rnd()), L = 40 + rnd() * 50, down = rnd() < 0.5;
                tracks.push({ d: `M${f(vx)} ${f(TRAP_Y)} L${f(vx + Math.cos(a) * L * (rnd() < 0.5 ? -1 : 1))} ${f(TRAP_Y + (down ? 1 : -1) * Math.sin(a) * L * 0.5)}`, col: '#ffd60a', len: L, t: t0 - 0.1, dash: true });
            }
        }
    });
    const x0 = GX - 30, x1 = GX + weeks.length * STEP + 10;
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">`);
    out.push(`<title>${USER}: ${cal.totalContributions} contributions in the last year, shown as antiproton annihilations in a Penning trap</title>`);
    out.push(`<style>
.c{transition:none}
@keyframes flash{0%{fill:${P.flash}}1.2%{fill:${P.flash}}9%{fill:var(--b)}100%{fill:var(--b)}}
@keyframes trk{0%{stroke-dashoffset:var(--l);opacity:1}1.6%{stroke-dashoffset:0;opacity:1}5.5%{opacity:0}100%{stroke-dashoffset:0;opacity:0}}
@keyframes boom{0%{transform:scale(.1);opacity:.95}2%{transform:scale(1);opacity:.55}5%{transform:scale(1.4);opacity:0}100%{transform:scale(1.4);opacity:0}}
@keyframes bunch{0%{transform:translateX(-60px);opacity:0}2%{opacity:1}${pct(SWEEP0)}{transform:translateX(0)}${pct(SWEEP1)}{transform:translateX(${f(x1 - x0)}px);opacity:1}${pct(SWEEP1 + 1.6)}{transform:translateX(${f(x1 - x0 + 70)}px);opacity:0}100%{transform:translateX(${f(x1 - x0 + 70)}px);opacity:0}}
@keyframes breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.4,.75)}}
.hit{animation:flash ${LOOP}s linear infinite}
.t{fill:none;stroke-width:1.4;stroke-linecap:round;opacity:0;stroke-dasharray:var(--l);stroke-dashoffset:var(--l);animation:trk ${LOOP}s linear infinite}
.t.n{stroke-dasharray:3 4;stroke-width:1}
.b{fill:${P.glow};opacity:0;transform-box:fill-box;transform-origin:center;animation:boom ${LOOP}s linear infinite}
.bunch{animation:bunch ${LOOP}s linear infinite}
.bunch ellipse{transform-box:fill-box;transform-origin:center;animation:breathe 1.2s ease-in-out infinite}
</style>`);
    out.push(`<rect width="${W}" height="${H}" rx="10" fill="${P.bg}"/>`);
    // month labels
    let lastM = -1;
    weeks.forEach((wk, wi) => {
        const m = new Date(wk.contributionDays[0].date + 'T00:00:00Z').getUTCMonth();
        if (m !== lastM && wi < weeks.length - 2) { out.push(`<text x="${GX + wi * STEP}" y="${GY - 9}" font-size="10" fill="${P.muted}">${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]}</text>`); lastM = m; }
    });
    ['Mon', 'Wed', 'Fri'].forEach((s, i) => out.push(`<text x="${GX - 8}" y="${GY + (1 + 2 * i) * STEP + 9}" font-size="9" fill="${P.muted}" text-anchor="end">${s}</text>`));
    // the solenoid and the trap
    const ty = TRAP_Y;
    out.push(`<rect x="${x0 - 6}" y="${ty - 30}" width="${f(x1 - x0 + 12)}" height="60" rx="12" fill="${P.coil}" stroke="${P.coilLine}" stroke-dasharray="2 4"/>`);
    out.push(`<rect x="${x0}" y="${ty - 9}" width="${f(x1 - x0)}" height="18" rx="9" fill="${P.tube}" stroke="${P.tubeLine}"/>`);
    for (let x = x0 + 10; x < x1 - 8; x += 15) out.push(`<rect x="${f(x)}" y="${ty - 9}" width="10" height="3" rx="1" fill="${P.gold}" opacity=".85"/><rect x="${f(x)}" y="${ty + 6}" width="10" height="3" rx="1" fill="${P.gold}" opacity=".85"/>`);
    // tracks under the cells
    tracks.forEach(tr => out.push(`<path class="t${tr.dash ? ' n' : ''}" d="${tr.d}" stroke="${tr.col}" style="--l:${f(tr.len)};animation-delay:${tr.t.toFixed(2)}s"/>`));
    booms.forEach(b => out.push(`<circle class="b" cx="${f(b.x)}" cy="${ty}" r="14" style="animation-delay:${b.t.toFixed(2)}s"/>`));
    // detector cells
    cells.forEach(c => {
        const base = P.cells[c.lvl];
        out.push(`<rect class="c${c.hit ? ' hit' : ''}" x="${c.cx}" y="${c.cy}" width="${CELL}" height="${CELL}" rx="2.5" fill="${base}"${c.hit ? ` style="--b:${base};animation-delay:${c.t.toFixed(2)}s"` : ''}><title>${c.date}: ${c.n} contribution${c.n === 1 ? '' : 's'}</title></rect>`);
    });
    // the antiproton bunch
    out.push(`<g class="bunch" style="transform-box:fill-box"><g transform="translate(${x0},${ty})"><circle r="14" fill="${P.glow}" opacity=".18"/><ellipse rx="9" ry="4.2" fill="${P.pbar}"/></g></g>`);
    // caption and legend
    out.push(`<text x="${GX}" y="${H - 14}" font-size="11" fill="${P.muted}"><tspan fill="${P.ink}" font-weight="600">${cal.totalContributions.toLocaleString('en-GB')} contributions</tspan> in the last year · each one an antiproton annihilation in the trap</text>`);
    let lx = W - 160;
    TRACK.forEach(([c, s]) => { out.push(`<line x1="${lx}" y1="${H - 18}" x2="${lx + 14}" y2="${H - 18}" stroke="${c}" stroke-width="2" stroke-linecap="round"/><text x="${lx + 18}" y="${H - 14}" font-size="11" fill="${P.muted}">${s}</text>`); lx += 38; });
    out.push(`<line x1="${lx}" y1="${H - 18}" x2="${lx + 14}" y2="${H - 18}" stroke="#ffd60a" stroke-width="1.4" stroke-dasharray="3 3"/><text x="${lx + 18}" y="${H - 14}" font-size="11" fill="${P.muted}">γ</text>`);
    out.push('</svg>');
    return out.join('\n');
}

const dir = new URL('../assets/contrib/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });
for (const t of ['dark', 'light']) fs.writeFileSync(new URL(`penning-${t}.svg`, dir), build(t));
console.log(`${cal.totalContributions} contributions, ${weeks.length} weeks -> assets/contrib/penning-{dark,light}.svg`);
