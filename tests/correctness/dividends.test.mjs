// 3:12 amounts compared with values published by Skatteverket.
// https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/beloppochprocentsatser.4.34f3b0b713e2cf5455b7288.html
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, salarySweep } from '../../js/engine.js';
import { fixtureData } from '../helpers/data.mjs';
import { BASE_INPUT } from '../helpers/cases.mjs';

// Schablonbelopp (förenklingsregeln) for one owner, 2.75 x previous year's inkomstbasbelopp.
const FORENKLINGSREGELN = { 2020: 177100, 2021: 183700, 2022: 187550, 2023: 195250, 2024: 204325, 2025: 209550 };

test('förenklingsregeln equals published schablonbelopp', () => {
  for (const [year, expected] of Object.entries(FORENKLINGSREGELN)) {
    const r = calculate({ ...BASE_INPUT, year: Number(year) }, fixtureData);
    assert.equal(r.dividendsLimitForenklingsregeln, expected, year);
  }
});

test('2026 grundbelopp is 4 x inkomstbasbelopp 2025', () => {
  const r = calculate({ ...BASE_INPUT, year: 2026 }, fixtureData);
  assert.equal(r.grundbelopp, 322400);
});

test('2026 lönebaserat utrymme: half of salaries above 8 inkomstbasbelopp', () => {
  const r = calculate({ ...BASE_INPUT, year: 2026, grossSalaryMonth: 70000, salaryMonths: 12, useSemesterersattning: false }, fixtureData);
  assert.equal(r.salaryBasedLimit, 0.5 * (840000 - 8 * 80600));
  const low = calculate({ ...BASE_INPUT, year: 2026, grossSalaryMonth: 40000, salaryMonths: 12, useSemesterersattning: false }, fixtureData);
  assert.equal(low.salaryBasedLimit, 0);
});

test('2026 klyvningsränta only on omkostnadsbelopp above 100 000 kr', () => {
  assert.equal(calculate({ ...BASE_INPUT, omkostnadsbelopp: 100000 }, fixtureData).omkostnadsbeloppInterest, 0);
  assert.equal(calculate({ ...BASE_INPUT, omkostnadsbelopp: 200000 }, fixtureData).omkostnadsbeloppInterest, 0.1155 * 100000);
});

test('salary sweep varies salary even when "lön upp till brytpunkt" is ticked', () => {
  const r = calculate({ ...BASE_INPUT, useMaxGrossSalary: true }, fixtureData);
  const s = salarySweep(r, fixtureData);
  assert.ok(s.netSalaryYear[10] < s.netSalaryYear[50], 'net salary should grow along the sweep');
  assert.deepEqual(s, salarySweep(calculate(BASE_INPUT, fixtureData), fixtureData));
});

test('a loss gives no bolagsskatt and no dividend', () => {
  const r = calculate({ ...BASE_INPUT, invoicedAmount: 300000 }, fixtureData);
  assert.ok(r.profitBeforeTax < 0);
  assert.equal(r.profitAfterTax, r.profitBeforeTax);
  assert.equal(r.grossDividends, 0);
});
