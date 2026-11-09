// Downloads Skatteverket's grundavdrag tables (open data) into data/grundavdrag/.
// Usage: node tools/fetch-grundavdrag.mjs 2026 [2027 ...]
// In environments with an HTTP proxy, run with NODE_USE_ENV_PROXY=1.
import { writeFile, mkdir } from 'node:fs/promises';

const DATASETS = {
  under66: 'ebbd8d70-9b9c-4327-b2ce-a371ee66744c',
  from66: '43902bf8-cb34-4288-ab95-2080f8a878dc',
};
const BASE = 'https://skatteverket.entryscape.net/rowstore/dataset';
const outDir = new URL('../data/grundavdrag/', import.meta.url);

async function fetchAll(id, year) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const res = await fetch(`${BASE}/${id}?%C3%A5r=${year}&_limit=500&_offset=${offset}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`${res.status} for ${id} ${year}`);
    const data = await res.json();
    rows.push(...data.results);
    if (data.results.length < 500) return rows;
  }
}

const years = process.argv.slice(2).map(Number);
if (!years.length) {
  console.error('Usage: node tools/fetch-grundavdrag.mjs <year> [year ...]');
  process.exit(1);
}
await mkdir(outDir, { recursive: true });
for (const year of years) {
  for (const [group, id] of Object.entries(DATASETS)) {
    const raw = await fetchAll(id, year);
    if (!raw.length) {
      console.warn(`No data for ${group} ${year}`);
      continue;
    }
    // Each row: [ink from, ink tom (null = open ended), gr avdrag (null = equals income, "FastInk")]
    const rows = raw.map((r) => [
      parseInt(r['ink from']),
      r['ink tom'] === '' ? null : parseInt(r['ink tom']),
      /^\d+$/.test(r['gr avdrag']) ? parseInt(r['gr avdrag']) : null,
    ]);
    const file = new URL(`${year}-${group}.json`, outDir);
    const json = JSON.stringify({ year, group, source: `${BASE}/${id}`, rows })
      .replace(/\],\[/g, '],\n[');
    await writeFile(file, json + '\n');
    console.log(`${year} ${group}: ${rows.length} rows`);
  }
}
