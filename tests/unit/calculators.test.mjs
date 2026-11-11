// Stand-alone calculators used by the quick calculators.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, dividendLimit, employerCost, equivalentEmployeeSalary, privateIncomeTax } from '../../js/engine.js';
import { fixtureData } from '../helpers/data.mjs';
import { BASE_INPUT, generateCases } from '../helpers/cases.mjs';

test('dividendLimit gives the same limit as the full calculation', () => {
  for (const input of [BASE_INPUT, ...generateCases(80, 3)]) {
    const r = calculate(input, fixtureData);
    if (isNaN(r.dividendsLimit)) continue;
    const d = dividendLimit({ year: r.year, ownSalary: r.grossSalaryYear, omkostnadsbelopp: r.omkostnadsbelopp, savedDividends: r.savedDividends });
    assert.equal(d.limit, r.dividendsLimit, JSON.stringify(input));
  }
});

// From 2026 the grundbelopp (4 x inkomstbasbelopp) is split equally per share in each
// company, and one person gets at most one grundbelopp over all companies (Skatteverket's
// examples: 50/50 owners get 161 200 each; 25 % + 75 % + 100 % gives 40 300, 120 900, 161 200).
test('dividendLimit: grundbelopp per share, at most one per person (2026)', () => {
  const g = (ownership, ownershipInOtherCompanies = 0) =>
    dividendLimit({ year: 2026, ownSalary: 500000, ownership, ownershipInOtherCompanies, omkostnadsbelopp: 25000 }).grundbelopp;
  assert.equal(g(1), 322400);
  assert.equal(g(0.5), 161200);
  assert.equal(g(0.5, 0.5), 161200);
  assert.equal(g(0.25, 1.75), 40300);
  assert.equal(g(0.75, 1.25), 120900);
  assert.equal(g(1, 1), 161200);
});

test('employerCost adds arbetsgivaravgift, pension, insurance and särskild löneskatt', () => {
  const c = employerCost({ year: 2026, yearBorn: 1985, grossSalaryMonth: 55000 });
  assert.equal(c.arbetsgivaravgift, 0.3142 * 55000);
  assert.equal(c.pension, 0.047 * 55000);
  assert.ok(Math.abs(c.insurance - 200 / 12) < 1e-9);
  assert.ok(Math.abs(c.slp - 0.2426 * (c.pension + c.insurance)) < 1e-9);
  assert.ok(Math.abs(c.total - (55000 + c.arbetsgivaravgift + c.pension + c.insurance + c.slp)) < 1e-9);
  assert.equal(employerCost({ year: 2026, yearBorn: 1985, grossSalaryMonth: 55000, usePension: false }).pension, 0);
  assert.equal(c.pensionNonDeductible, 0);
});

test('employerCost follows the age rules and the pension cap, like the structure', () => {
  // Born 1950 (2026): 10,21 %. Young people get the temporary reduction.
  assert.ok(Math.abs(employerCost({ year: 2026, yearBorn: 1950, grossSalaryMonth: 50000 }).arbetsgivaravgift - 0.1021 * 50000) < 1e-9);
  assert.ok(employerCost({ year: 2026, yearBorn: 2004, grossSalaryMonth: 20000 }).arbetsgivaravgift < 0.3142 * 20000);
  // A high pension rate goes over the deduction cap (35 % of the salary).
  assert.ok(employerCost({ year: 2026, yearBorn: 1985, grossSalaryMonth: 55000, pensionRate: 0.5 }).pensionNonDeductible > 0);
  // The same figures as the company calculation for one employee.
  const input = { year: 2026, yearBorn: 1985, grossSalaryMonth: 55000 };
  const quick = employerCost(input);
  const company = calculate({ ...BASE_INPUT, ...input, useSemesterersattning: false, vacationDays: 0, useMaxGrossSalary: false, salaryMonths: 12 }, fixtureData);
  assert.ok(Math.abs(12 * quick.total - (company.grossSalaryYear + company.arbetsgivaravgift + company.pension + company.insurance + company.slp)) < 1e-6);
});

test('equivalentEmployeeSalary finds the lowest salary reaching the net target', () => {
  const person = { year: 2026, yearBorn: 1985, kommunalSkattPercent: 30.55, burialSkattPercent: 0.07 };
  const net = (g) => (12 * g - privateIncomeTax({ ...person, income: 12 * g }, fixtureData).incomeTax) / 12;
  for (const target of [20000, 42617, 64814, 90000]) {
    const { grossSalaryMonth } = equivalentEmployeeSalary({ targetNetMonth: target, ...person }, fixtureData);
    assert.ok(net(grossSalaryMonth) >= target, `${target}`);
    assert.ok(net(grossSalaryMonth - 1) < target, `${target} not minimal`);
  }
  assert.ok(Number.isNaN(equivalentEmployeeSalary({ targetNetMonth: 0, ...person }, fixtureData).grossSalaryMonth));
});

test('pension level: 4.7 % is the default and other levels flow through the company', () => {
  const base = calculate(BASE_INPUT, fixtureData);
  assert.deepEqual(calculate({ ...BASE_INPUT, pensionPercent: 4.7 }, fixtureData), base);
  const none = calculate({ ...BASE_INPUT, pensionPercent: 0 }, fixtureData);
  const ten = calculate({ ...BASE_INPUT, pensionPercent: 10 }, fixtureData);
  assert.equal(none.pension, 0);
  assert.equal(ten.pension, 0.1 * ten.grossSalaryYear);
  assert.equal(ten.slp, 0.2426 * (ten.pension + ten.insurance));
  assert.ok(ten.profitBeforeTax < base.profitBeforeTax && base.profitBeforeTax < none.profitBeforeTax);
  assert.equal(calculate({ ...BASE_INPUT, usePension: false, pensionPercent: 10 }, fixtureData).pension, 0);
});

test('other salary is taxed together with the salary from the company', () => {
  const input = { ...BASE_INPUT, useSemesterersattning: false, grossSalaryMonth: 40000, otherSalaryYear: 300000 };
  const r = calculate(input, fixtureData);
  const person = { year: 2026, yearBorn: 1985, kommunalSkattPercent: 30.55, burialSkattPercent: 0.07 };
  const total = privateIncomeTax({ ...person, income: 480000 + 300000 }, fixtureData);
  const alone = privateIncomeTax({ ...person, income: 300000 }, fixtureData);
  assert.equal(r.personIncomeTax, total.incomeTax);
  assert.equal(r.otherIncomeTax, alone.incomeTax);
  assert.equal(r.incomeTax, total.incomeTax - alone.incomeTax);
  assert.equal(r.otherNetYear, 300000 - alone.incomeTax);
  const withoutOther = calculate({ ...input, otherSalaryYear: 0 }, fixtureData);
  assert.ok(r.incomeTax > withoutOther.incomeTax, 'the company salary is taxed higher on top of another salary');
  assert.ok(Math.abs(r.netSumMonth - (withoutOther.netSumMonth - (withoutOther.netSalaryMonth - r.netSalaryMonth) + r.otherNetYear / 12)) < 1e-6);
  // 3:12 uses only the salary from the company.
  assert.equal(r.dividendsLimit, withoutOther.dividendsLimit);
});

test('"lön upp till brytpunkt" counts the other salary', () => {
  const r = calculate({ ...BASE_INPUT, useMaxGrossSalary: true, useSemesterersattning: false, otherSalaryYear: 200000 }, fixtureData);
  assert.ok(r.grossSalaryYear + 200000 <= 660400 && r.grossSalaryYear + 200000 > 660400 - 12);
  assert.equal(r.statligSkatt, 0);
});
