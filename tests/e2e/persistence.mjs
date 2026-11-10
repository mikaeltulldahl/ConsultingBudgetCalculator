// End-to-end test of remembering data, export/import, CSV export and scenarios, in a real
// browser. Needs Playwright with Chromium and network access (församling lookup).
// Run: npm run test:e2e
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = new URL('../../', import.meta.url);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname.replace(/^\/$/, '/index.html');
    const body = await readFile(new URL('.' + decodeURIComponent(path), root));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const URL_ = `http://localhost:${server.address().port}/`;

const FIELDS = ['year', 'hourlyRate', 'billingStartDate', 'billingEndDate', 'workingRate', 'vacationDays',
  'billableHours', 'invoicedAmount', 'otherRevenue', 'yearBorn', 'kommunSelector', 'churchMember',
  'forsamlingSelector', 'kommunalSkattPercent', 'churchSkattPercent', 'grossSalaryMonth', 'salaryMonths',
  'useSemesterersattning', 'usePension', 'otherCosts', 'omkostnadsbelopp', 'savedDividends', 'maxDividend',
  'grossDividends', 'incomeTax', 'netSalaryMonth', 'totalCost', 'dividendsLimit', 'netDividends',
  'netSumMonth', 'totalTax', 'totalTaxPercentage'];

const snapshot = (page) => page.evaluate((ids) => Object.fromEntries(ids.map((id) => {
  const el = document.getElementById(id);
  if (el.type === 'checkbox') return [id, el.checked];
  if (el.tagName === 'SELECT') return [id, el.selectedOptions[0]?.text ?? ''];
  if (el.tagName === 'OUTPUT') return [id, el.dataset.value ?? ''];
  return [id, el.value];
})), FIELDS);

// Shows a part of the structure (its card) by clicking it in the map or the phone flow.
const goto = (p, part) => p.locator(`[data-goto="${part}"] >> visible=true`).first().click();

const settle = (page) => page.waitForTimeout(1500);
const errors = [];
let passed = 0;
async function step(name, fn) {
  await fn();
  passed++;
  console.log(`ok - ${name}`);
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(URL_, { waitUntil: 'networkidle' });

  // Fill in a scenario, including church membership and a manual billable-hours value.
  await goto(page, 'person');
  await page.fill('#yearBorn', '1985');
  await page.dispatchEvent('#yearBorn', 'input');
  await page.selectOption('#kommunSelector', { label: 'STOCKHOLM' });
  await page.check('#churchMember');
  await page.waitForFunction(() => document.querySelector('#forsamlingSelector').options.length > 1, null, { timeout: 20000 });
  await page.selectOption('#forsamlingSelector', { label: 'ADOLF FREDRIKS FÖRSAMLING' });
  await goto(page, 'uppdrag');
  await page.fill('#hourlyRate', '850');
  await page.dispatchEvent('#hourlyRate', 'input');
  await page.click('details:has(#billableHours) summary');
  await page.fill('#billableHours', '1500');
  await page.dispatchEvent('#billableHours', 'input');
  await goto(page, 'pension');
  await page.uncheck('#usePension');
  await settle(page);
  const filled = await snapshot(page);
  assert.equal(filled.invoicedAmount, '1275000');
  assert.notEqual(filled.netSumMonth, '');

  await step('everything is remembered after reloading', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await settle(page);
    assert.deepEqual(await snapshot(page), filled);
  });

  let exported;
  await step('export, clear and import gives the same page', async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportJson')]);
    exported = await download.path();
    await page.click('#clearData');
    await settle(page);
    const cleared = await snapshot(page);
    assert.equal(cleared.yearBorn, '');
    assert.equal(cleared.netSumMonth, '');
    assert.equal(cleared.hourlyRate, '700');
    assert.equal(await page.evaluate(() => localStorage.length), 0, 'nothing stored after clearing');
    await page.setInputFiles('#importFile', exported);
    await settle(page);
    assert.deepEqual(await snapshot(page), filled);
  });

  await step('CSV contains every visible value with its explanation', async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportCsv')]);
    const csv = await readFile(await download.path(), 'utf8');
    assert.ok(csv.startsWith('﻿'), 'BOM');
    const rows = csv.slice(1).trim().split('\r\n').map((l) => l.split(';'));
    const find = (label) => rows.find((r) => r[1] === label);
    const net = find('Månadssumma (lön + utdelning) netto');
    assert.equal(net[2], filled.netSumMonth);
    assert.equal(net[3], 'Beräknat');
    assert.match(net[4], /Månadslön netto/);
    assert.equal(find('Timpris exkl. moms')[2], '850');
    assert.equal(find('Kommun')[2], 'STOCKHOLM');
    assert.equal(find('Kommunal skatt (%)')[2], '30,55');
    assert.equal(find('Medlem i Svenska kyrkan')[2], 'Ja');
    assert.ok(rows.length > 50, `${rows.length} rows`);
  });

  await step('saved scenarios are compared and can be loaded', async () => {
    await page.click('#scenarioDetails summary');
    await page.fill('#scenarioName', 'Högt pris');
    await page.click('#saveScenario');
    await goto(page, 'uppdrag');
    await page.fill('#hourlyRate', '600');
    await page.dispatchEvent('#hourlyRate', 'input');
    await settle(page);
    const low = await snapshot(page);
    await page.fill('#scenarioName', 'Lågt pris');
    await page.click('#saveScenario');
    await settle(page);
    const table = await page.$$eval('#scenarioTable tr', (trs) => trs.map((tr) => [...tr.children].map((c) => c.innerText.split('\n')[0])));
    assert.deepEqual(table[0].slice(1).map((s) => s.trim()), ['Nuvarande', 'Högt pris', 'Lågt pris']);
    const netRow = table.find((r) => r[0].startsWith('Månadssumma'));
    const fmt = (v) => Number(v).toLocaleString('sv-SE');
    assert.equal(netRow[2], fmt(filled.netSumMonth));
    assert.equal(netRow[3], fmt(low.netSumMonth));
    assert.equal(netRow[1], fmt(low.netSumMonth));
    // Load the first scenario: the page returns to the high price.
    await page.click('#scenarioTable thead th:nth-child(3) button:has-text("Ladda")');
    await settle(page);
    assert.deepEqual(await snapshot(page), filled);
    // Scenarios survive a reload.
    await page.reload({ waitUntil: 'networkidle' });
    await settle(page);
    assert.equal(await page.$$eval('#scenarioTable thead th', (ths) => ths.length), 4);
  });

  await step('the company can use its own invoiced amount', async () => {
    await goto(page, 'faktura');
    assert.ok(await page.isVisible('#structureMap g.edge.selected[data-goto="faktura"]'), 'Fakturerat arrow is highlighted');
    await page.click('#toggleManualInvoiced');
    await page.fill('#manualInvoicedAmount', '1000000');
    await page.dispatchEvent('#manualInvoicedAmount', 'input');
    await settle(page);
    assert.equal(await page.getAttribute('#usedInvoicedAmount', 'data-value'), '1000000');
    assert.equal((await page.textContent('#sumInvoiced')).replace(/\s/g, ' '), '1 000 000 kr');
    await page.click('#toggleManualInvoiced');
    await settle(page);
    assert.equal(await page.getAttribute('#usedInvoicedAmount', 'data-value'), filled.invoicedAmount);
  });

  await step('pension level is set on the Pension arrow', async () => {
    await goto(page, 'pension');
    assert.ok(await page.isDisabled('#pensionPercent'), 'level is disabled while pension is off');
    await page.check('#usePension');
    await page.fill('#pensionPercent', '10');
    await page.dispatchEvent('#pensionPercent', 'input');
    await settle(page);
    const gross = Number(await page.getAttribute('#grossSalaryYear', 'data-value'));
    assert.equal(Number(await page.getAttribute('#pension', 'data-value')), Math.round(0.1 * gross));
    assert.equal(await page.getAttribute('#companyPension', 'data-value'), await page.getAttribute('#pension', 'data-value'));
    assert.match(await page.textContent('#structureMap'), /pension/);
    await page.fill('#pensionPercent', '4.7');
    await page.uncheck('#usePension');
    await settle(page);
    assert.equal(await page.getAttribute('#totalCost', 'data-value'), filled.totalCost);
  });

  await step('explanation popover opens with a source link', async () => {
    await goto(page, 'person');
    await page.click('#details-tax-summary, details:has(#grundavdrag) > summary');
    await page.click('label[for="grundavdrag"] .info');
    assert.ok(await page.isVisible('#popover'));
    assert.match(await page.textContent('#popover'), /Grundavdrag/);
    const popHtml = await page.innerHTML('#popover');
    assert.match(popHtml, /href="https:\/\/lagen\.nu\/1999:1229#K63P3"/, popHtml);
    await page.keyboard.press('Escape');
    assert.ok(!(await page.isVisible('#popover')));
  });

  await step('quick calculator matches Skatteverket and connects to the structure', async () => {
    await page.click('[data-mode="quick"]');
    await page.waitForTimeout(500);
    await page.selectOption('#qp-kommun', 'STOCKHOLM');
    await page.fill('#qp-income', '660000');
    await page.dispatchEvent('#qp-income', 'input');
    await page.waitForTimeout(500);
    // Skatteverket's calculator: 147 018 kr for 660 000 kr, born 1985, Stockholm, 2026.
    assert.equal(await page.getAttribute('#qp-incomeTax', 'data-value'), '147018');
    await page.click('[data-quick="motsv"]');
    await page.click('#qm-fromStructure');
    await page.waitForTimeout(300);
    assert.ok(Number(await page.getAttribute('#qm-gross', 'data-value')) > 0);
    await page.click('[data-quick="privat"]');
    await page.click('[data-connect="privat"]');
    await settle(page);
    assert.ok(await page.isVisible('#structureMode'));
    assert.equal(await page.inputValue('#grossSalaryMonth'), '55000');
    assert.equal(await page.inputValue('#yearBorn'), '1985');
    // Back to the saved high-price scenario for the next steps.
    await page.evaluate(() => { document.getElementById('scenarioDetails').open = true; });
    await page.click('#scenarioTable thead th:nth-child(3) button:has-text("Ladda")');
    await settle(page);
  });

  await step('phone layout: flow list, no horizontal scroll, dark mode without errors', async () => {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' });
    const p = await phone.newPage();
    const phoneErrors = [];
    p.on('pageerror', (e) => phoneErrors.push(e.message));
    await p.goto(URL_, { waitUntil: 'networkidle' });
    assert.ok(await p.isVisible('#structureTree .flow-list'));
    assert.ok(!(await p.isVisible('#structureMap svg')));
    await goto(p, 'utdelning');
    assert.ok(await p.isVisible('.part[data-part="utdelning"]'));
    await p.waitForTimeout(800);
    const headingTop = await p.evaluate(() => document.querySelector('.part[data-part="utdelning"] h2').getBoundingClientRect().top);
    assert.ok(headingTop >= 0 && headingTop < 200, `card heading should be on screen after tapping, top=${headingTop}`);
    // Quick calculators open right under their button (accordion).
    await p.click('[data-mode="quick"]');
    await p.click('[data-quick="grans"]');
    const gap = await p.evaluate(() => document.getElementById('qc-grans').getBoundingClientRect().top
      - document.querySelector('[data-quick="grans"]').getBoundingClientRect().bottom);
    assert.ok(Math.abs(gap) < 2, `calculator should open under its button, gap=${gap}`);
    assert.equal(await p.locator('[data-quick-card]:visible').count(), 1);
    await p.click('[data-mode="structure"]');
    const { docW, vw } = await p.evaluate(() => ({ docW: document.documentElement.scrollWidth, vw: innerWidth }));
    assert.ok(docW <= vw, `page is ${docW}px wide on a ${vw}px screen`);
    assert.deepEqual(phoneErrors, []);
    await phone.close();
  });

  await step('scenario table does not widen the page on a phone', async () => {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await phone.newPage();
    p.on('dialog', (d) => d.accept());
    await p.goto(URL_, { waitUntil: 'networkidle' });
    await p.setInputFiles('#importFile', exported);
    await p.waitForTimeout(500);
    await p.click('#scenarioDetails summary');
    for (const name of ['Ett långt scenarionamn', 'Ett till långt scenarionamn', 'Tredje']) {
      await p.fill('#scenarioName', name);
      await p.click('#saveScenario');
    }
    await p.waitForTimeout(500);
    const { docW, vw } = await p.evaluate(() => ({ docW: document.documentElement.scrollWidth, vw: innerWidth }));
    assert.ok(docW <= vw, `page is ${docW}px wide on a ${vw}px screen`);
    await phone.close();
  });

  await step('page works when browser storage is blocked', async () => {
    const blocked = await browser.newContext();
    await blocked.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    });
    const p = await blocked.newPage();
    const blockedErrors = [];
    p.on('pageerror', (e) => blockedErrors.push(e.message));
    await p.goto(URL_, { waitUntil: 'networkidle' });
    await goto(p, 'person');
    await p.fill('#yearBorn', '1985');
    await p.dispatchEvent('#yearBorn', 'input');
    await p.selectOption('#kommunSelector', { label: 'STOCKHOLM' });
    await settle(p);
    assert.notEqual(await p.getAttribute('#netSumMonth', 'data-value'), '');
    assert.deepEqual(blockedErrors, []);
    await blocked.close();
  });

  assert.deepEqual(errors, [], 'no errors in the page');
  console.log(`\n${passed} passed`);
} finally {
  await browser.close();
  server.close();
}
