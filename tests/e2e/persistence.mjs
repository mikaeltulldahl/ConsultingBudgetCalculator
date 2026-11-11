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

const FIELDS = ['year', 'hourlyRate-a1', 'startDate-a1', 'endDate-a1', 'workingRate-a1', 'vacationDays',
  'billableHours-a1', 'used-a1', 'otherRevenue', 'yearBorn', 'kommunSelector', 'churchMember',
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
// Prefers boxes in the map and buttons in the phone flow; a curved arrow's bounding box can
// have empty space in the middle, where a click lands on nothing.
// Person parts without a person id mean the first person ("lon" = "lon-p1").
const goto = async (p, part) => {
  if (/^(person|lon|pension|utdelning|annan)$/.test(part)) part = `${part}-p1`;
  const preferred = p.locator(`#structureMap g.node[data-goto="${part}"], #structureTree button[data-goto="${part}"]`).locator('visible=true');
  if (await preferred.count()) return preferred.first().click();
  return p.locator(`[data-goto="${part}"] >> visible=true`).first().click();
};

const settle = (page) => page.waitForTimeout(1500);
const errors = [];
let passed = 0;
async function step(name, fn) {
  await fn();
  passed++;
  console.log(`ok - ${name}`);
}

// The page asks in its own <dialog>; answer OK automatically unless a step turns it off.
// The browser's own confirm() must not be used (some embedded browsers block it).
const AUTO_ANSWER = () => {
  window.autoAnswer = true;
  const show = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function showModal() {
    show.call(this);
    if (window.autoAnswer) setTimeout(() => this.querySelector('#confirmOk')?.click());
  };
};
const noNativeDialogs = (p) => p.on('dialog', (d) => { errors.push(`native dialog: ${d.message()}`); d.dismiss(); });

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.addInitScript(AUTO_ANSWER);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  noNativeDialogs(page);
  await page.goto(URL_, { waitUntil: 'networkidle' });

  // Fill in a scenario, including church membership and a manual billable-hours value.
  await goto(page, 'person');
  await page.fill('#yearBorn', '1985');
  await page.dispatchEvent('#yearBorn', 'input');
  await page.selectOption('#kommunSelector', { label: 'STOCKHOLM' });
  await page.check('#churchMember');
  await page.waitForFunction(() => document.querySelector('#forsamlingSelector').options.length > 1, null, { timeout: 20000 });
  await page.selectOption('#forsamlingSelector', { label: 'ADOLF FREDRIKS FÖRSAMLING' });
  await goto(page, 'uppdrag-a1');
  await page.fill('#hourlyRate-a1', '850');
  await page.dispatchEvent('#hourlyRate-a1', 'input');
  await page.click('details:has(#billableHours-a1) summary');
  await page.fill('#billableHours-a1', '1500');
  await page.dispatchEvent('#billableHours-a1', 'input');
  await goto(page, 'pension');
  await page.uncheck('#usePension');
  await settle(page);
  const filled = await snapshot(page);
  assert.equal(filled['used-a1'], '1275000');
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
    assert.equal(cleared['hourlyRate-a1'], '700');
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
    await goto(page, 'uppdrag-a1');
    await page.fill('#hourlyRate-a1', '600');
    await page.dispatchEvent('#hourlyRate-a1', 'input');
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
    await goto(page, 'faktura-a1');
    assert.ok(await page.isVisible('#structureMap g.edge.selected[data-goto="faktura-a1"]'), 'Fakturerat arrow is highlighted');
    await page.click('[data-action="toggleManual"][data-a="a1"]');
    await page.fill('#manualAmount-a1', '1000000');
    await page.dispatchEvent('#manualAmount-a1', 'input');
    await settle(page);
    assert.equal(await page.getAttribute('#used-a1', 'data-value'), '1000000');
    assert.equal((await page.textContent('#sumInvoiced')).replace(/\s/g, ' '), '1 000 000 kr');
    await page.click('[data-action="toggleManual"][data-a="a1"]');
    await settle(page);
    assert.equal(await page.getAttribute('#used-a1', 'data-value'), filled['used-a1']);
  });

  await step('a second assignment with a price change adds up and is remembered', async () => {
    await page.click('#addAssignment');
    assert.ok(await page.isVisible('.part[data-part="uppdrag-a2"]'));
    await page.fill('#name-a2', 'Kund B');
    await page.fill('#startDate-a2', '2026-01-01');
    await page.dispatchEvent('#startDate-a2', 'input');
    await page.fill('#hourlyRate-a2', '1000');
    await page.dispatchEvent('#hourlyRate-a2', 'input');
    await page.click('[data-action="addPrice"][data-a="a2"]');
    // Price changes sit between the start and the end date, and a new one starts inside the assignment.
    const order = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('.part[data-part="uppdrag-a2"] input, .part[data-part="uppdrag-a2"] [data-action="addPrice"]')]
        .map((el) => el.id || el.dataset.action);
      return ['startDate-a2', 'pcFrom-a2-0', 'addPrice', 'endDate-a2'].map((x) => ids.indexOf(x));
    });
    assert.ok(order.every((x, k) => x >= 0 && (k === 0 || x > order[k - 1])), `order ${order}`);
    const first = await page.inputValue('#pcFrom-a2-0');
    assert.ok(first > '2026-01-01' && first <= await page.inputValue('#endDate-a2'), first);
    await page.click('[data-action="addPrice"][data-a="a2"]');
    assert.ok(await page.inputValue('#pcFrom-a2-1') > first);
    await page.click('[data-action="removePrice"][data-a="a2"][data-pc="1"]');
    await page.fill('#pcFrom-a2-0', '2026-07-01');
    await page.dispatchEvent('#pcFrom-a2-0', 'input');
    await page.fill('#pcRate-a2-0', '1100');
    await page.dispatchEvent('#pcRate-a2-0', 'input');
    await settle(page);
    const map = (await page.textContent('#structureMap')).replace(/\s/g, ' ');
    assert.match(map, /Kund B/);
    assert.match(map, /1 000–1 100 kr\/h/);
    const a1 = Number(await page.getAttribute('#used-a1', 'data-value'));
    const a2 = Number(await page.getAttribute('#used-a2', 'data-value'));
    assert.ok(a2 > 1000 * 900, `second assignment ${a2}`);
    assert.equal(Number(await page.getAttribute('#companyInvoiced', 'data-value')), a1 + a2);
    await page.reload({ waitUntil: 'networkidle' });
    await settle(page);
    assert.equal(await page.inputValue('#pcRate-a2-0'), '1100', 'price change remembered');
    await goto(page, 'uppdrag-a2');
    await page.click('[data-action="removeAssignment"][data-a="a2"]');
    await settle(page);
    assert.equal(await page.locator('.part[data-part="uppdrag-a2"]').count(), 0);
    assert.equal(await page.getAttribute('#companyInvoiced', 'data-value'), filled['used-a1']);
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
    // A fixed amount above the cap (35 % of salary) shows the warning.
    await page.selectOption('#pensionMode', 'amount');
    await page.fill('#pensionAmount', String(Math.round(0.5 * gross)));
    await page.dispatchEvent('#pensionAmount', 'input');
    await settle(page);
    assert.ok(await page.isVisible('#pensionCapWarning'), 'warning over the deduction cap');
    assert.ok(Number(await page.getAttribute('#pensionNonDeductible', 'data-value')) > 0);
    await page.selectOption('#pensionMode', 'percent');
    await page.fill('#pensionPercent', '4.7');
    await page.uncheck('#usePension');
    await settle(page);
    assert.equal(await page.getAttribute('#totalCost', 'data-value'), filled.totalCost);
  });

  await step('other employment is taxed together and shown in the map', async () => {
    await goto(page, 'person');
    const before = Number(await page.getAttribute('#netSumMonth', 'data-value'));
    await page.click('#addOther');
    assert.ok(await page.isVisible('.part[data-part="annan"]'));
    await page.fill('#otherEmployer', 'Kund C');
    await page.fill('#otherSalaryYear', '200000');
    await page.dispatchEvent('#otherSalaryYear', 'input');
    await settle(page);
    assert.match(await page.textContent('#structureMap'), /Kund C/);
    const after = Number(await page.getAttribute('#netSumMonth', 'data-value'));
    const otherNet = Number(await page.getAttribute('#otherNetYear', 'data-value'));
    assert.ok(otherNet > 0 && otherNet < 200000);
    assert.ok(after > before && after < before + otherNet / 12, 'net per month includes the other job, and the AB salary pays more tax');
    await page.reload({ waitUntil: 'networkidle' });
    await settle(page);
    assert.equal(await page.inputValue('#otherSalaryYear'), '200000', 'remembered after reload');
    await goto(page, 'annan');
    await page.click('#removeOther');
    await settle(page);
    assert.ok(!(await page.isVisible('.part[data-part="annan"]')));
    assert.equal(Number(await page.getAttribute('#netSumMonth', 'data-value')), before);
  });

  await step('owners: dividends per share, tightest limit, owners table, other owners', async () => {
    await goto(page, 'person');
    const before = await page.getAttribute('#netSumMonth', 'data-value');
    const value = async (id) => Number(await page.getAttribute(`#${id}`, 'data-value'));
    // Opens the Utdelning card of the person shown, through the chip on the person card.
    const dividendCard = async (person) => {
      await goto(page, `person-${person}`);
      await page.click('.part.active button.from[data-goto="utdelning"]');
    };
    await page.click('#addPerson');
    await settle(page);
    assert.ok(await page.isVisible('#structureMap g.node[data-goto="person-p2"]'));
    assert.equal((await page.textContent('#h-person')).trim().startsWith('Person 2'), true);
    await page.fill('#personName', 'Anna');
    await page.fill('#ownership', '50');
    await page.fill('#yearBorn', '1990');
    await page.dispatchEvent('#yearBorn', 'input');
    await page.click('.part.active button.from[data-goto="lon"]');
    await page.fill('#grossSalaryMonth', '40000');
    await page.dispatchEvent('#grossSalaryMonth', 'input');
    await settle(page);
    assert.match(await page.textContent('#structureMap'), /Anna/);
    // 100 % + 50 % is too much: warning and no dividend until fixed under Ägare.
    await goto(page, 'bolag');
    assert.match(await page.textContent('.part[data-part="bolag"] .ownership-warning'), /150 %/);
    assert.equal(await page.getAttribute('#companyDividend', 'data-value'), '', 'no dividend above 100 %');
    assert.ok(await page.isVisible('#ownersTable'));
    await page.fill('#ownerInputs input[data-owner="p1"]', '50');
    await settle(page);
    assert.equal(await page.getAttribute('#ownershipTotal', 'data-value'), '100.00');
    assert.ok(!(await page.isVisible('.ownership-warning >> visible=true').catch(() => false)));
    await goto(page, 'person-p1');
    assert.equal(await page.inputValue('#ownership'), '50');
    await dividendCard('p1');
    await settle(page);
    assert.ok(await page.isVisible('#ownersRows'));
    const cap = await value('dividendCap');
    const total = await value('companyDividend');
    const mine = await value('ownerGrossDividends');
    const myLimit = await value('dividendsLimit');
    await dividendCard('p2');
    await settle(page);
    const annas = await value('ownerGrossDividends');
    const annasLimit = await value('dividendsLimit');
    assert.equal(mine, annas, 'equal dividend per share');
    assert.equal(mine + annas, total);
    assert.ok(total <= cap && mine <= myLimit && annas <= annasLimit);
    assert.equal(cap, Math.min(myLimit, annasLimit) * 2);
    assert.match(await page.textContent('#limitingNote'), /begränsar/);
    assert.equal(await page.textContent('#sumNetName'), ' (Anna)');
    // Remembered after reloading, including which person is shown.
    await page.reload({ waitUntil: 'networkidle' });
    await settle(page);
    assert.equal(await page.inputValue('#personName'), 'Anna');
    assert.equal(await value('ownerGrossDividends'), annas);
    // Anna as an employee without shares: no dividend arrow, her salary still costs the company.
    await goto(page, 'person-p2');
    await page.fill('#ownership', '0');
    await page.dispatchEvent('#ownership', 'input');
    await goto(page, 'person-p1');
    await page.fill('#ownership', '100');
    await page.dispatchEvent('#ownership', 'input');
    await settle(page);
    assert.equal(await page.locator('#structureMap g.edge[data-goto="utdelning-p2"]').count(), 0);
    assert.equal(await page.locator('#structureMap g.edge[data-goto="lon-p2"]').count(), 1);
    // Removing Anna gives the one-person result again.
    // Asked in the page's own dialog: Avbryt keeps her, Ta bort removes her.
    await goto(page, 'person-p2');
    await page.evaluate(() => { window.autoAnswer = false; });
    await page.click('#removePerson');
    assert.ok(await page.isVisible('#confirmDialog'));
    assert.match(await page.textContent('#confirmMessage'), /Ta bort Anna\?/);
    await page.click('#confirmCancel');
    await settle(page);
    assert.ok(!(await page.isVisible('#confirmDialog')));
    assert.equal(await page.locator('#structureMap g.node[data-goto="person-p2"]').count(), 1);
    await page.click('#removePerson');
    await page.click('#confirmOk');
    await page.evaluate(() => { window.autoAnswer = true; });
    await settle(page);
    assert.equal(await page.locator('#structureMap g.node[data-goto="person-p2"]').count(), 0);
    assert.equal(await page.getAttribute('#netSumMonth', 'data-value'), before);
    // One person owning 60 %: the other 40 % belong to owners outside the calculation.
    await goto(page, 'person-p1');
    await page.fill('#ownership', '60');
    await settle(page);
    await goto(page, 'bolag');
    assert.ok(await page.isVisible('#otherOwnersRows'));
    assert.equal(await page.getAttribute('#otherOwnersShare', 'data-value'), '40.00');
    const companyTotal = Number(await page.getAttribute('#companyDividend', 'data-value'));
    assert.ok(Math.abs(Number(await page.getAttribute('#otherOwnersDividends', 'data-value')) - 0.4 * companyTotal) < 1);
    assert.match(await page.textContent('#structureMap'), /Övriga ägare/);
    await goto(page, 'person-p1');
    await page.fill('#ownership', '100');
    await settle(page);
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
    await p.addInitScript(AUTO_ANSWER);
    noNativeDialogs(p);
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
