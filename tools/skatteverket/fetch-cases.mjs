// Generates reference cases from Skatteverket's own tax calculator ("Räkna ut din skatt",
// https://www7.skatteverket.se/portal/rakna-ut-skatt) for tests/correctness/skatteverket.test.mjs.
//
// The calculator's backend is not a documented API and does not allow calls from other
// websites, so it cannot be used by the calculator page itself. This script opens the
// calculator in a headless browser and sends the same request the page sends, once per case.
//
// Usage: node tools/skatteverket/fetch-cases.mjs [year ...]    (default: all supported years)
// Requires Playwright with Chromium.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { YEARS } from '../../js/params.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PAGE = 'https://www7.skatteverket.se/portal/rakna-ut-skatt';
const API = '/portal-wapi/open/skatteberakning/fysisk/v1/public/api/rakna-ut-skatt';
const out = new URL('../../tests/fixtures/skatteverket-cases.json', import.meta.url);
const template = JSON.parse(await readFile(new URL('payload-template.json', import.meta.url), 'utf8'));

// Kommunal + regional skatt, begravningsavgift, kyrkoavgift (%), from Skatteverket open data.
const RATES = {
  stockholm: {
    kod: 180,
    2020: [29.82, 0.065, 1.105], 2021: [29.82, 0.065, 1.105], 2022: [29.82, 0.065, 1.105],
    2023: [29.82, 0.065, 1.105], 2024: [30.36, 0.065, 1.11], 2025: [30.6, 0.07, 1.18],
    2026: [30.55, 0.07, 1.18],
  },
  dorotea: { kod: 2425, 2020: [35.15, 0.25, 1.45], 2026: [35.65, 0.292, 1.3] },
};

const AGES = [30, 64, 65, 66, 67, 80];
const INCOMES = [0, 15000, 25000, 50000, 80000, 120000, 180000, 250000, 350000, 450000, 550000,
  620000, 650000, 700000, 760000, 850000, 1000000, 1300000, 2000000];

function buildCases(years) {
  const cases = [];
  for (const year of years) {
    for (const age of AGES) {
      for (const income of INCOMES) {
        cases.push({ year, yearBorn: year - age - 1, income, kommun: 'stockholm', church: false });
      }
    }
    if (RATES.dorotea[year]) {
      for (const income of [120000, 450000, 760000, 1300000]) {
        for (const age of [30, 70]) {
          cases.push({ year, yearBorn: year - age - 1, income, kommun: 'dorotea', church: true });
        }
      }
    }
  }
  return cases;
}

function payload(c) {
  const p = structuredClone(template);
  const [rate, burial, church] = RATES[c.kommun][c.year];
  Object.assign(p.grunduppgifter, {
    inkomstar: String(c.year),
    fodelsear: String(c.yearBorn),
    kommunkod: RATES[c.kommun].kod,
    prognos: false,
  });
  Object.assign(p.grunduppgifter.skatteAvgiftssatser, {
    kommunalLandstingsSkattesats: rate,
    avgiftssatsBegravningsavgift: burial,
    avgiftssatsKyrkoavgift: c.church ? church : null,
  });
  p.tjansteinkomster.restenAvAret.loneinkomsterResten = c.income;
  return { body: p, rates: { kommunalSkattPercent: rate, burialSkattPercent: burial, churchSkattPercent: c.church ? church : 0 } };
}

function flatten(node, acc = {}) {
  for (const leaf of node.leafs ?? []) {
    if (leaf.type === 'PresentationLeafDto') acc[leaf.apiText] = leaf.value;
    else flatten(leaf, acc);
  }
  return acc;
}

const years = process.argv.length > 2 ? process.argv.slice(2).map(Number) : Object.keys(YEARS).map(Number);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(PAGE, { waitUntil: 'networkidle', timeout: 60000 });

let existing = [];
try { existing = JSON.parse(await readFile(out, 'utf8')).cases; } catch {}
const results = existing.filter((c) => !years.includes(c.input.year));
const fetched = new Date().toISOString().slice(0, 10);

for (const c of buildCases(years)) {
  const { body, rates } = payload(c);
  const res = await page.evaluate(async ({ api, body }) => {
    const r = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: r.status, text: await r.text() };
  }, { api: API, body });
  if (res.status !== 200) {
    console.warn(`HTTP ${res.status} for ${JSON.stringify(c)}: ${res.text.slice(0, 200)}`);
    continue;
  }
  const flat = flatten(JSON.parse(res.text));
  if (!('slutligSkatt' in flat)) {
    console.warn(`No result for ${JSON.stringify(c)}`);
    continue;
  }
  const num = (k) => (k in flat ? parseInt(flat[k]) : 0);
  results.push({
    input: { year: c.year, yearBorn: c.yearBorn, income: c.income, ...rates },
    expected: {
      grundavdrag: num('grundavdrag'),
      kommunalSkatt: num('kommunalInkomstskatt'),
      statligSkatt: num('statligInkomstskattForvarvsinkomst'),
      burialSkatt: num('begravningsavgift'),
      churchSkatt: num('kyrkoavgift'),
      publicServiceSkatt: num('publicServiceAvgift'),
      allmanPensionsAvgift: num('allmanPensionsavgift'),
      jobbskatteavdrag: num('skattereduktionArbetsinkomster'),
      skattereduktionForvarvsinkomst: num('skattereduktionForvarvsinkomst'),
      tillfalligSkattereduktion: num('skattereduktionArbetsinkomstTillfallig'),
      incomeTax: num('slutligSkatt'),
    },
    raw: flat,
    fetched,
  });
  await new Promise((r) => setTimeout(r, 100)); // be gentle
}
await browser.close();

results.sort((a, b) => a.input.year - b.input.year || a.input.yearBorn - b.input.yearBorn || a.input.income - b.input.income);
const json = JSON.stringify({ source: PAGE, cases: results }, null, 0).replace(/\},\{"input"/g, '},\n{"input"');
await writeFile(out, json + '\n');
console.log(`${results.length} cases written to ${out.pathname}`);
