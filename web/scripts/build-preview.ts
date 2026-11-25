// Writes ../play/einheiten.html: a standalone sprite sheet with animation
// buttons. Run: npx tsx scripts/build-preview.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { UNITS, UNIT_ORDER, unitSvg } from '../src/render/units';

const css = readFileSync(new URL('../src/render/units.css', import.meta.url), 'utf8');
const font = readFileSync(new URL('../node_modules/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2', import.meta.url)).toString('base64');
const fred = readFileSync(new URL('../node_modules/@fontsource/fredoka/files/fredoka-latin-600-normal.woff2', import.meta.url)).toString('base64');

const GROUPS: [string, string, string][] = [
  ['necro', 'Death Cults', '#8e4fc4'],
  ['elves', 'Evergarden', '#f0b928'],
  ['giants', 'Giants', '#e0452f'],
  ['neutral', 'Wildlande', '#b9a88f'],
];

const card = (id: keyof typeof UNITS) => {
  const u = UNITS[id];
  return `<article class="card">
    <div class="stage">${unitSvg(id, 'idle big')}</div>
    <h3>${u.name}</h3>
    <p class="tier">Stufe ${u.tier}</p>
    <dl><div><dt>Angriff</dt><dd>+${u.attack}</dd></div><div><dt>Verteidigung</dt><dd>+${u.defense}</dd></div><div><dt>HP</dt><dd>${u.hp}</dd></div></dl>
    <div class="btns"><button data-a="attack">Angriff</button><button data-a="hit">Treffer</button><button data-a="die">Tod</button></div>
  </article>`;
};

const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Juräa Einheiten</title><style>
@font-face{font-family:Lilita;src:url(data:font/woff2;base64,${font}) format('woff2')}
@font-face{font-family:Fredoka;font-weight:600;src:url(data:font/woff2;base64,${fred}) format('woff2')}
:root{--ink:#2b1d14}
*{box-sizing:border-box}
body{margin:0;font-family:Fredoka,system-ui,sans-serif;font-weight:600;color:#fff4dc;background:radial-gradient(120% 90% at 50% 30%,#4ccfcf,#24a3ad 50%,#136a80);min-height:100vh;padding:24px 16px 60px}
h1,h2,h3{font-family:Lilita,system-ui;font-weight:400;margin:0;text-shadow:0 2px 0 var(--ink),0 -2px 0 var(--ink),2px 0 0 var(--ink),-2px 0 0 var(--ink),0 4px 0 var(--ink)}
h1{text-align:center;font-size:clamp(34px,6vw,56px)}
.lead{text-align:center;margin:8px auto 18px;max-width:60ch;color:#e9fffb;text-shadow:0 1px 0 var(--ink)}
.top{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:22px}
button{font:400 16px Lilita,system-ui;color:#fff;text-shadow:0 1.5px 0 var(--ink),0 -1.5px 0 var(--ink),1.5px 0 0 var(--ink),-1.5px 0 0 var(--ink);border:3px solid var(--ink);border-radius:12px;padding:8px 14px;background:linear-gradient(#c98a4b,#87501f);box-shadow:0 4px 0 #5a3214;cursor:pointer}
button:active{transform:translateY(3px);box-shadow:0 1px 0 #5a3214}
button:focus-visible{outline:3px solid #ffd23f;outline-offset:2px}
.group{max-width:1100px;margin:0 auto 26px}
.group h2{font-size:30px;margin:0 0 10px;display:flex;align-items:center;gap:10px}
.group h2 i{width:18px;height:18px;border-radius:50%;border:3px solid var(--ink);background:var(--c)}
.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.card{background:linear-gradient(#7a4a24,#573214);border:4px solid var(--ink);border-radius:18px 12px 20px 14px;box-shadow:0 6px 0 #3b200c,0 14px 24px rgba(8,30,52,.35);padding:12px;text-align:center}
.stage{height:190px;border-radius:12px;border:3px solid var(--ink);background:radial-gradient(80% 60% at 50% 90%,#a6d64d,#6fae35);display:grid;place-items:end center;overflow:hidden;cursor:pointer}
.stage .big{width:180px;height:180px}
.card h3{font-size:22px;margin-top:10px}
.tier{margin:2px 0 8px;color:#ffd9a0}
dl{display:flex;justify-content:center;gap:6px;margin:0 0 10px}
dl div{background:rgba(0,0,0,.3);border-radius:10px;padding:4px 8px;min-width:58px}
dt{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#ffd9a0}dd{margin:0;font:400 20px Lilita}
.btns{display:flex;gap:6px;justify-content:center}.btns button{font-size:14px;padding:6px 10px}
.minis{max-width:1100px;margin:0 auto;background:rgba(43,29,20,.75);border:3px solid var(--ink);border-radius:16px;padding:14px}
.minis h2{font-size:24px;margin-bottom:4px}.minis p{margin:0 0 10px;color:#ffe8c2}
.mini-row{display:flex;flex-wrap:wrap;gap:6px}.mini-row .sprite{width:40px;height:40px}
${css}
</style></head><body>
<h1>Einheiten von Juräa</h1>
<p class="lead">Neun Fraktionseinheiten und der neutrale Wildling für Regelwerk v2. Klick auf eine Figur oder die Knöpfe, um Angriff, Treffer und Tod zu sehen.</p>
<div class="top"><button id="all-attack">Alle greifen an</button><button id="all-hit">Alle getroffen</button><button id="reset">Alle zurücksetzen</button></div>
${GROUPS.map(([f, name, c]) => `<section class="group"><h2><i style="--c:${c}"></i>${name}</h2><div class="row">${UNIT_ORDER.filter((id) => UNITS[id].faction === f).map(card).join('')}</div></section>`).join('')}
<section class="minis"><h2>So groß auf dem Hexfeld</h2><p>Etwa 40 Pixel, wie die Figuren auf der Karte.</p><div class="mini-row">${UNIT_ORDER.map((id) => unitSvg(id, 'idle')).join('')}</div></section>
<script>
const T={attack:700,hit:450,die:900};
function play(el,a){el.classList.remove('a-attack','a-hit','a-die');void el.getBoundingClientRect();el.classList.add('a-'+a);if(a!=='die')setTimeout(()=>el.classList.remove('a-'+a),T[a]);}
document.querySelectorAll('.card').forEach(c=>{const s=c.querySelector('.sprite');c.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>play(s,b.dataset.a));c.querySelector('.stage').onclick=()=>play(s,'attack');});
const all=()=>document.querySelectorAll('.card .sprite');
document.getElementById('all-attack').onclick=()=>all().forEach((s,i)=>setTimeout(()=>play(s,'attack'),i*90));
document.getElementById('all-hit').onclick=()=>all().forEach((s,i)=>setTimeout(()=>play(s,'hit'),i*60));
document.getElementById('reset').onclick=()=>all().forEach(s=>s.classList.remove('a-attack','a-hit','a-die'));
</script></body></html>`;
writeFileSync(new URL('../../play/einheiten.html', import.meta.url), html);
console.log('wrote play/einheiten.html', (html.length / 1024).toFixed(0) + ' KB');
