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

// From 2026 each owner has one grundbelopp (4 x inkomstbasbelopp) in total, split over the
// companies that person owns in proportion to ownership.
test('dividendLimit: grundbelopp is per owner, split over their companies (2026)', () => {
  const full = dividendLimit({ year: 2026, ownSalary: 500000, omkostnadsbelopp: 25000 });
  const halfOwnerOnlyCompany = dividendLimit({ year: 2026, ownSalary: 500000, ownership: 0.5, omkostnadsbelopp: 25000 });
  const halfHereHalfElsewhere = dividendLimit({ year: 2026, ownSalary: 500000, ownership: 0.5, ownershipInOtherCompanies: 0.5, omkostnadsbelopp: 25000 });
  assert.equal(full.grundbelopp, 322400);
  assert.equal(halfOwnerOnlyCompany.grundbelopp, 322400);
  assert.equal(halfHereHalfElsewhere.grundbelopp, 161200);
});

test('employerCost adds arbetsgivaravgift, pension and särskild löneskatt', () => {
  const c = employerCost({ grossSalaryMonth: 55000 });
  assert.equal(c.arbetsgivaravgift, 0.3142 * 55000);
  assert.equal(c.pension, 0.047 * 55000);
  assert.equal(c.slp, 0.2426 * c.pension);
  assert.equal(c.total, 55000 + c.arbetsgivaravgift + c.pension + c.slp);
  assert.equal(employerCost({ grossSalaryMonth: 55000, usePension: false }).pension, 0);
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
