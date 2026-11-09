// Properties that must hold for any input, independent of tax rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, privateIncomeTax } from '../../js/engine.js';
import { YEARS } from '../../js/params.js';
import { fixtureData } from '../helpers/data.mjs';
import { generateCases } from '../helpers/cases.mjs';

const cases = generateCases(300, 42);
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

test('money is conserved in the company', () => {
  for (const input of cases) {
    const r = calculate(input, fixtureData);
    if (isNaN(r.totalTax)) continue;
    const revenue = r.invoicedAmount + r.otherRevenue;
    const costs = r.otherCosts + r.grossSalaryYear + r.pension + r.insurance + r.slp + r.arbetsgivaravgift;
    close(revenue - costs, r.profitBeforeTax, 'profit before tax');
    close(r.profitBeforeTax - r.bolagsTax, r.profitAfterTax, 'bolagsskatt');
    close(r.profitAfterTax - r.grossDividends, r.profitAfterDividends, 'dividends');
    close(r.grossDividends - r.dividendTax, r.netDividends, 'dividend tax');
  }
});

test('money is conserved for the person', () => {
  for (const input of cases) {
    const r = calculate(input, fixtureData);
    if (isNaN(r.incomeTax)) continue;
    close(r.grossSalaryYear - r.incomeTax, r.netSalaryYear, 'net salary');
  }
});

test('taxes and reductions are never negative', () => {
  const nonNegative = ['incomeTax', 'kommunalSkatt', 'statligSkatt', 'burialSkatt', 'churchSkatt',
    'publicServiceSkatt', 'jobbskatteavdrag', 'skattereduktionForvarvsinkomst', 'arbetsgivaravgift',
    'slp', 'grossDividends', 'dividendTax', 'totalTax'];
  for (const input of cases) {
    const r = calculate(input, fixtureData);
    for (const k of nonNegative) {
      if (!isNaN(r[k])) assert.ok(r[k] >= 0, `${k} = ${r[k]} for ${JSON.stringify(input)}`);
    }
  }
});

test('dividend never exceeds the limit', () => {
  for (const input of cases) {
    const r = calculate(input, fixtureData);
    if (!isNaN(r.grossDividends)) assert.ok(r.grossDividends <= r.dividendsLimit, JSON.stringify(input));
  }
});

// Above 60 000 kr a year, a raise must not lower the net salary by more than rounding.
// (Below that, allmän pensionsavgift legitimately starts at 0.423 prisbasbelopp before
// there is any tax to reduce it against, so net pay dips by ~1 500 kr there. Above it,
// the official 100 kr roundings of grundavdrag and pensionsavgift give dips of a few kr.)
for (const year of Object.keys(YEARS).map(Number)) {
  test(`net salary increases with gross salary, ${year}`, () => {
    for (const age of [30, 70]) {
      let prevNet = -Infinity;
      for (let income = 60000; income <= 1500000; income += 100) {
        const r = privateIncomeTax({ year, yearBorn: year - age - 1, income, kommunalSkattPercent: 32, burialSkattPercent: 0.25, churchSkattPercent: 1 }, fixtureData);
        const net = income - r.incomeTax;
        assert.ok(net >= prevNet - 10, `age ${age}, income ${income}: net ${net} < ${prevNet}`);
        prevNet = net;
      }
    }
  });
}

test('zero salary months gives finite results', () => {
  const r = calculate({ ...cases[0], salaryMonths: 0, useSemesterersattning: false, useMaxGrossSalary: true }, fixtureData);
  for (const k of ['grossSalaryMonth', 'netSalaryMonth', 'netSumMonth']) {
    assert.ok(Number.isFinite(r[k]), `${k} = ${r[k]}`);
  }
});
