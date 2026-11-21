// Visitor trajectory map: where visitors to my website come from, drawn like particle tracks in a detector.
// Each country with visitors launches a curved track (charged particles bend in a magnetic field) that spirals in
// to where I work now; heavier traffic = brighter, thicker track. Pure SVG + CSS animation (plays on GitHub).
// Data: GoatCounter (the CV site already counts visits there), the last 90 days, countries only.
// Run by .github/workflows/visitor-map.yml; locally: GOATCOUNTER_TOKEN=... node scripts/visitor-map.mjs
//   DEMO=1 node scripts/visitor-map.mjs   draws made-up numbers, for trying the look without a token.
import fs from 'node:fs';
import vm from 'node:vm';

const SITE = process.env.GOATCOUNTER_SITE || 'bharatrawat';
const token = process.env.GOATCOUNTER_TOKEN;
const DAYS = 90;
const OUT = 'assets/visitors';

// ---------- data ----------
async function visitors() {
    if (process.env.DEMO) return { demo: true, list: [['GB', 120], ['US', 95], ['IN', 80], ['CH', 44], ['DE', 31], ['FR', 22], ['CA', 40], ['ES', 14], ['IT', 12], ['JP', 9], ['CN', 8], ['BR', 6], ['AU', 6], ['RU', 5], ['NL', 7], ['UZ', 3], ['CO', 3], ['ZA', 2], ['KR', 4], ['SG', 3]] };
    if (!token) { console.log('No GOATCOUNTER_TOKEN: nothing to draw (add it as a repository secret).'); process.exit(0); }
    const end = new Date(), start = new Date(end - DAYS * 864e5), d = x => x.toISOString().slice(0, 10);
    const list = [];
    let offset = 0;
    for (let page = 0; page < 10; page++) {
        const url = `https://${SITE}.goatcounter.com/api/v0/stats/locations?start=${d(start)}&end=${d(end)}&limit=100&offset=${offset}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'visitor-map' } });
        if (!res.ok) throw new Error(`GoatCounter ${res.status}: ${await res.text()}`);
        const j = await res.json();
        for (const s of j.stats || []) {
            const code = String(s.id || '').toUpperCase().slice(0, 2), n = s.count_unique ?? s.count ?? 0;
            if (/^[A-Z]{2}$/.test(code) && n > 0) list.push([code, n]);
        }
        if (!j.more) break;
        offset += (j.stats || []).length;
    }
    return { demo: false, list };
}
// where I am now: PROFILE.home in the CV data (profile.js in the Dossier repo) if set, else the first role's place
async function home() {
    try {
        const src = process.env.PROFILE_JS;     // a local profile.js, for trying changes before they are pushed
        const code = src ? fs.readFileSync(src, 'utf8') : await (await fetch('https://raw.githubusercontent.com/Bharat-Singh-Rawat/Dossier/main/profile.js')).text();
        const ctx = { window: {}, document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }, console };
        vm.runInNewContext(code, ctx);
        const P = ctx.window.PROFILE, p = P.home || P.experience[0].place, q = Array.isArray(p) ? p[0] : p;
        if (q && isFinite(q.lat) && isFinite(q.lon)) return { name: q.name, lat: q.lat, lon: q.lon };
    } catch (e) { console.log('profile.js not readable, using the default home:', e.message); }
    return { name: 'Vancouver, Canada', lat: 49.28, lon: -123.12 };
}

const CENT = JSON.parse(fs.readFileSync('data/country-centroids.json', 'utf8'));
const LAND = JSON.parse(fs.readFileSync('data/land-dots.json', 'utf8'));
const { demo, list } = await visitors();
const HOME = await home();
const rows = list.filter(([c]) => CENT[c]).sort((a, b) => b[1] - a[1]);
const total = rows.reduce((s, r) => s + r[1], 0);

// ---------- drawing ----------
const W = 900, H = 430, MX = 10, MY = 52, MW = W - 2 * MX, LAT0 = 80, LAT1 = -56, MH = H - MY - 34;
// centred on home, so every track takes the short way round (Asia comes in across the Pacific, Europe across the Atlantic)
const wrap = a => ((a % 360) + 540) % 360 - 180;
const px = lon => MX + (wrap(lon - HOME.lon) + 180) / 360 * MW, py = lat => MY + (LAT0 - lat) / (LAT0 - LAT1) * MH;
const f = n => n.toFixed(1);
const PAL = {
    dark: { bg: '#0d1117', ink: '#e6edf3', muted: '#7d8590', land: '#30363d', tracks: ['#64d2ff', '#bf5af2', '#ff9f0a', '#30d158', '#ff375f'], home: '#ffd60a', glow: '#ffffff' },
    light: { bg: '#ffffff', ink: '#1f2328', muted: '#656d76', land: '#d0d7de', tracks: ['#0a84ff', '#af52de', '#ff9500', '#28a745', '#ff2d55'], home: '#bf8700', glow: '#1f2328' }
};
// deterministic: the picture only changes when the numbers do
let seed = 7; for (const [c, n] of rows) seed = (seed * 31 + n + c.charCodeAt(0) * 3 + c.charCodeAt(1)) % 2147483647;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// a track from a country to home: a curve bent to one side (the "charge"), ending in a small inward spiral
function track(lat, lon, k) {
    const x0 = px(lon), y0 = py(lat), x1 = px(HOME.lon), y1 = py(HOME.lat);
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const q = k % 2 ? 1 : -1, bend = q * Math.min(0.42 * L, 120) * (0.6 + 0.5 * rnd());
    const c1x = x0 + dx * 0.3 + nx * bend, c1y = y0 + dy * 0.3 + ny * bend, c2x = x0 + dx * 0.78 + nx * bend * 0.45, c2y = y0 + dy * 0.78 + ny * bend * 0.45;
    // last stretch: a tightening curl round the home point, like a slowing particle in the field
    let d = `M${f(x0)} ${f(y0)}C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(x1 + nx * q * 9)} ${f(y1 + ny * q * 9)}`;
    const a0 = Math.atan2(ny * q, nx * q);
    for (let i = 1; i <= 10; i++) { const a = a0 + q * i * 0.62, r = 9 * (1 - i / 11); d += `L${f(x1 + Math.cos(a) * r)} ${f(y1 + Math.sin(a) * r)}`; }
    return { d, x0, y0, len: L * 1.25 + 40 };
}

function build(theme) {
    const P = PAL[theme], out = [], LOOP = 9;
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">`);
    out.push(`<style>
        .trk { fill: none; stroke-linecap: round; }
        .run { fill: none; stroke-linecap: round; stroke-dasharray: 26 2000; animation: run ${LOOP}s linear infinite; }
        @keyframes run { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -2000; } }
        .src { animation: blink ${LOOP}s ease-in-out infinite; }
        @keyframes blink { 0%, 100% { opacity: 0.55; } 6% { opacity: 1; } 20% { opacity: 0.55; } }
        .ring { fill: none; stroke: ${P.home}; transform-origin: ${f(px(HOME.lon))}px ${f(py(HOME.lat))}px; animation: ring 3s ease-out infinite; }
        @keyframes ring { from { transform: scale(0.4); opacity: 0.9; } to { transform: scale(2.6); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .run, .src, .ring { animation: none; } .run { display: none; } }
    </style>`);
    out.push(`<rect width="${W}" height="${H}" rx="12" fill="${P.bg}"/>`);
    // land: one path of round dots
    out.push(`<path d="${LAND.map(([la, lo]) => `M${f(px(lo))} ${f(py(la))}h0`).join('')}" stroke="${P.land}" stroke-width="3.1" stroke-linecap="round"/>`);
    // tracks, weakest first so the strong ones sit on top
    const max = rows.length ? rows[0][1] : 1;
    [...rows].reverse().forEach(([c, n], i) => {
        const k = rows.length - 1 - i, [lat, lon] = CENT[c], t = track(lat, lon, k), w = Math.log1p(n) / Math.log1p(max);
        const col = P.tracks[k % P.tracks.length], delay = -(k * 0.83 % LOOP).toFixed(2);
        out.push(`<path class="trk" d="${t.d}" stroke="${col}" stroke-width="${f(0.7 + 1.6 * w)}" opacity="${(0.22 + 0.5 * w).toFixed(2)}"/>`);
        out.push(`<path class="run" d="${t.d}" stroke="${col}" stroke-width="${f(1.4 + 2 * w)}" style="animation-delay:${delay}s;animation-duration:${(LOOP * (0.8 + 0.4 * (1 - w))).toFixed(2)}s"/>`);
        out.push(`<circle class="src" cx="${f(t.x0)}" cy="${f(t.y0)}" r="${f(1.8 + 2.6 * w)}" fill="${col}" style="animation-delay:${delay}s"><title>${c}: ${n}</title></circle>`);
    });
    // home: where the tracks end
    const hx = px(HOME.lon), hy = py(HOME.lat);
    out.push(`<circle class="ring" cx="${f(hx)}" cy="${f(hy)}" r="8" stroke-width="1.5"/><circle class="ring" cx="${f(hx)}" cy="${f(hy)}" r="8" stroke-width="1.5" style="animation-delay:-1.5s"/>`);
    out.push(`<circle cx="${f(hx)}" cy="${f(hy)}" r="4.2" fill="${P.home}"/><circle cx="${f(hx)}" cy="${f(hy)}" r="1.6" fill="${P.bg}"/>`);
    // caption
    const nc = rows.length;
    out.push(`<text x="24" y="32" font-size="15" font-weight="600" fill="${P.ink}">Visitors to my website${demo ? ' (sample data)' : ''}</text>`);
    out.push(`<text x="24" y="${H - 14}" font-size="11.5" fill="${P.muted}">${nc} ${nc === 1 ? 'country' : 'countries'} · last ${DAYS} days · tracks curl in to ${HOME.name.replace(/&/g, '&amp;')}</text>`);
    out.push(`<text x="${W - 24}" y="${H - 14}" font-size="11.5" fill="${P.muted}" text-anchor="end">Brighter track = more visitors</text>`);
    out.push('</svg>');
    return out.join('\n');
}

fs.mkdirSync(OUT, { recursive: true });
for (const theme of ['dark', 'light']) fs.writeFileSync(`${OUT}/map-${theme}.svg`, build(theme));
console.log(`Drew ${rows.length} countries (${total} visitors${demo ? ', sample data' : ''}) into ${OUT}/map-{dark,light}.svg; home: ${HOME.name}`);
