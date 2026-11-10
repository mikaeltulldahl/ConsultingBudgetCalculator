// Arbetsgivaravgift by birth year and the pension deduction cap, against the rules on
// Skatteverket's "Belopp och procent" pages and inkomstskattelagen 28 kap. 5 §.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arbetsgivaravgift, pensionDeductionCap, calculate } from '../../js/engine.js';
import { fixtureData } from '../helpers/data.mjs';
import { BASE_INPUT } from '../helpers/cases.mjs';

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);
const avgift = (year, yearBorn, month, months = 12) =>
  arbetsgivaravgift({ year, yearBorn, grossSalaryMonth: month, salaryMonths: months, grossSalaryYear: month * months });

test('2026 birth-year bands (Skatteverket, inkomstår 2026)', () => {
  close(avgift(2026, 1937, 50000), 0, 'född 1937 eller tidigare');
  close(avgift(2026, 1938, 50000), 0.1021 * 600000, 'född 1938');
  close(avgift(2026, 1958, 50000), 0.1021 * 600000, 'född 1958');
  close(avgift(2026, 1959, 50000), 0.3142 * 600000, 'född 1959');
  close(avgift(2026, 2002, 50000), 0.3142 * 600000, 'född 2002');
});

test('2026 youth reduction: 20,81 % up to 25 000 kr/month from April', () => {
  // Born 2003-2007: 9 months (April-December) with 20,81 % on the first 25 000 kr.
  const full = 0.3142 * 600000;
  close(avgift(2026, 2003, 50000), full - 9 * 25000 * (0.3142 - 0.2081), 'above the cap');
  close(avgift(2026, 2007, 20000), 0.3142 * 240000 - 9 * 20000 * (0.3142 - 0.2081), 'below the cap');
  close(avgift(2026, 2008, 20000), 0.3142 * 240000, 'born 2008: not covered');
});

test('older-person band moves one birth year per year', () => {
  const pensionOnly = { 2020: 1954, 2021: 1955, 2022: 1956, 2023: 1956, 2024: 1957, 2025: 1958, 2026: 1958 };
  for (const [year, last] of Object.entries(pensionOnly)) {
    close(avgift(Number(year), last, 40000), 0.1021 * 480000, `${year} född ${last}`);
    // 2020 has a temporary reduction for everyone in March-June, see below.
    if (year !== '2020') close(avgift(Number(year), last + 1, 40000), 0.3142 * 480000, `${year} född ${last + 1}`);
  }
});

test('2020 corona reduction (March-June) and 2021-2022 youth reductions', () => {
  close(avgift(2020, 1985, 40000), 0.3142 * 480000 - 4 * 25000 * (0.3142 - 0.1021), '2020 corona');
  close(avgift(2021, 2000, 30000), 0.3142 * 360000 - 9 * 25000 * (0.3142 - 0.1973) - 3 * 25000 * (0.3142 - 0.1021), '2021 19-23 år');
  close(avgift(2022, 2004, 20000), 0.3142 * 240000 - 12 * 20000 * (0.3142 - 0.1021), '2022 15-17 år');
});

test('salary months are spread over the year', () => {
  // 6 salary months: half of them fall in April-December's share (9/12).
  close(avgift(2026, 2005, 30000, 6), 0.3142 * 180000 - 6 * 9 / 12 * 25000 * (0.3142 - 0.2081), 'half year');
});

test('engine uses the birth year: a 67-year-old pays only ålderspensionsavgift', () => {
  const r = calculate({ ...BASE_INPUT, yearBorn: 1958 }, fixtureData);
  close(r.arbetsgivaravgift, 0.1021 * r.grossSalaryYear, '2026 född 1958');
});

test('pension deduction cap: 35 % of salary, at most 10 prisbasbelopp', () => {
  assert.equal(pensionDeductionCap(400000, 59200), 140000);
  assert.equal(pensionDeductionCap(2000000, 59200), 592000);
  const within = calculate({ ...BASE_INPUT, pensionMode: 'amount', pensionAmount: 100000 }, fixtureData);
  assert.equal(within.pensionNonDeductible, 0);
  const over = calculate({ ...BASE_INPUT, pensionMode: 'amount', pensionAmount: 400000 }, fixtureData);
  const cap = 0.35 * over.grossSalaryYear;
  close(over.pensionDeductible, cap, 'deductible part');
  close(over.pensionNonDeductible, 400000 - cap, 'non-deductible part');
  // The non-deductible part is taxed: bolagsskatt on profit + non-deductible pension.
  close(over.bolagsTax, Math.max(0, over.profitBeforeTax + over.pensionNonDeductible) * 0.206, 'bolagsskatt');
  close(over.slp, 0.2426 * (400000 + over.insurance), 'SLP on the whole premium');
});
