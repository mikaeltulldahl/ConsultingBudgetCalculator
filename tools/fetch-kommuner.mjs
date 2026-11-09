// Downloads kommunal + regional skatt and begravningsavgift per kommun from Skatteverket's
// open data and writes data/kommuner.json: { year: { KOMMUN: [skattesats, begravningsavgift] } }.
// Kyrkoavgift depends on församling and is still looked up live by the page.
// Usage: NODE_USE_ENV_PROXY=1 node tools/fetch-kommuner.mjs 2026 [2027 ...]
import { readFile, writeFile } from 'node:fs/promises';

const DATASET = 'https://skatteverket.entryscape.net/rowstore/dataset/c67b320b-ffee-4876-b073-dd9236cd2a99';
const file = new URL('../data/kommuner.json', import.meta.url);

async function fetchYear(year) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const res = await fetch(`${DATASET}?%C3%A5r=${year}&_limit=500&_offset=${offset}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${res.status} for ${year}`);
    const data = await res.json();
    rows.push(...data.results);
    if (data.results.length < 500) return rows;
  }
}

const years = process.argv.slice(2).map(Number);
if (!years.length) {
  console.error('Usage: node tools/fetch-kommuner.mjs <year> [year ...]');
  process.exit(1);
}
let all = {};
try { all = JSON.parse(await readFile(file, 'utf8')); } catch {}
for (const year of years) {
  const out = {};
  for (const r of await fetchYear(year)) {
    // Rates are in percent with a decimal point; round away float noise from the sum.
    const rate = Math.round((parseFloat(r['kommunal-skatt']) + parseFloat(r['landstings-skatt'])) * 1000) / 1000;
    const burial = parseFloat(r['begravnings-avgift']);
    const prev = out[r.kommun];
    if (prev && (prev[0] !== rate || prev[1] !== burial)) {
      console.warn(`${year} ${r.kommun}: differing rates ${prev} vs ${[rate, burial]}`);
    }
    out[r.kommun] = [rate, burial];
  }
  if (!Object.keys(out).length) {
    console.warn(`No data for ${year}`);
    continue;
  }
  all[year] = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b, 'sv')));
  console.log(`${year}: ${Object.keys(out).length} kommuner`);
}
const json = '{\n' + Object.entries(all).map(([y, k]) => `"${y}": ${JSON.stringify(k)}`).join(',\n') + '\n}\n';
await writeFile(file, json);
