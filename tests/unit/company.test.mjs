// A company with several people: owners and/or employees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, calculateCompany, companySalarySweep, dividendLimit, salarySweep } from '../../js/engine.js';
import { fixtureData } from '../helpers/data.mjs';
import { BASE_INPUT, generateCases } from '../helpers/cases.mjs';

const COMPANY_KEYS = ['invoicedAmount', 'otherRevenue', 'otherCosts', 'maxDividend', 'grossDividends'];

// Splits calculate() inputs into company and one person owning everything.
function single(input) {
  const company = Object.fromEntries(COMPANY_KEYS.map((k) => [k, input[k]]));
  const person = Object.fromEntries(Object.entries(input).filter(([k]) => !COMPANY_KEYS.includes(k) && k !== 'year'));
  return { year: input.year, company, people: [{ id: 'p1', ownershipPercent: 100, employed: true, ...person }] };
}

const PERSON_KEYS = [
  'grossSalaryMonth', 'grossSalaryYear', 'incomeTax', 'personIncomeTax', 'netSalaryMonth', 'netSalaryYear', 'otherNetYear',
  'pension', 'pensionNonDeductible', 'slp', 'arbetsgivaravgift', 'insurance', 'dividendsLimit', 'salaryBasedLimit',
  'grundbelopp', 'dividendsLimitForenklingsregeln', 'grossDividends', 'netDividends', 'totalTax', 'netSumMonth',
];
const TOTAL_KEYS = ['totalCost', 'profitBeforeTax', 'profitAfterTax', 'grossDividends', 'profitAfterDividends', 'totalTax', 'totalTaxPercentage', 'bolagsTaxExclDividends'];

test('one owner gives exactly the same result as calculate()', () => {
  for (const input of [BASE_INPUT, ...generateCases(150, 7), ...generateCases(60, 11).map((c) => ({ ...c, otherSalaryYear: 250000 }))]) {
    const old = calculate(input, fixtureData);
    const r = calculateCompany(single(input), fixtureData);
    for (const k of PERSON_KEYS) assert.ok(Object.is(r.people[0][k], old[k]), `${k}: ${r.people[0][k]} vs ${old[k]} ${JSON.stringify(input)}`);
    for (const k of TOTAL_KEYS) assert.ok(Object.is(r.company[k], old[k]), `company ${k}: ${r.company[k]} vs ${old[k]}`);
  }
});

test('one owner: the salary sweep is the same as before', () => {
  for (const input of [BASE_INPUT, { ...BASE_INPUT, year: 2024, usePension: false }]) {
    assert.deepEqual(companySalarySweep(single(input), 0, fixtureData), salarySweep(calculate(input, fixtureData), fixtureData));
  }
});

const person = (id, extra) => ({
  ...single(BASE_INPUT).people[0], id, ...extra,
});

function twoOwners(year, a = {}, b = {}) {
  return {
    year,
    company: { ...single(BASE_INPUT).company, invoicedAmount: 2600000 },
    people: [person('p1', { ownershipPercent: 50, ...a }), person('p2', { ownershipPercent: 50, ...b })],
  };
}

for (const year of [2025, 2026]) {
  test(`two working owners 50/50 (${year}): limits per owner, tightest sets the total, equal per share`, () => {
    const inputs = twoOwners(year, { grossSalaryMonth: 60000 }, { grossSalaryMonth: 40000, omkostnadsbelopp: 25000 });
    const r = calculateCompany(inputs, fixtureData);
    const [p1, p2] = r.people;
    const total = p1.grossSalaryYear + p2.grossSalaryYear;
    for (const f of [p1, p2]) {
      const d = dividendLimit({ year, ownSalary: f.grossSalaryYear, totalSalary: total, ownership: 0.5, omkostnadsbelopp: 25000 });
      assert.equal(f.dividendsLimit, d.limit);
    }
    const cap = Math.min(p1.dividendsLimit, p2.dividendsLimit) / 0.5;
    assert.equal(r.company.dividendCap, cap);
    assert.equal(r.company.grossDividends, Math.max(0, Math.min(cap, r.company.profitAfterTax)));
    assert.equal(p1.grossDividends, p2.grossDividends);
    assert.equal(p1.grossDividends + p2.grossDividends, r.company.grossDividends);
    assert.ok(p1.grossDividends <= p1.dividendsLimit && p2.grossDividends <= p2.dividendsLimit);
    assert.equal(r.company.limitingOwner, p1.dividendsLimit <= p2.dividendsLimit ? 'p1' : 'p2');
    assert.ok(r.company.totalCost > 0 && Number.isFinite(p1.netSumMonth) && Number.isFinite(p2.netSumMonth));
  });
}

test('2026: grundbelopp is split per share, löneunderlag × share − 8 IBB', () => {
  const r = calculateCompany(twoOwners(2026, { grossSalaryMonth: 70000 }, { grossSalaryMonth: 70000 }), fixtureData);
  const total = r.company.grossSalaryYear;
  for (const f of r.people) {
    assert.equal(f.grundbelopp, 161200);
    assert.equal(f.salaryBasedLimit, 0.5 * Math.max(0, 0.5 * total - 8 * 80600));
  }
});

test('passive owner: no salary, 2025 förenklingsregeln for the share, 2026 grundbelopp only', () => {
  const r25 = calculateCompany(twoOwners(2025, {}, { employed: false }), fixtureData);
  const passive25 = r25.people[1];
  assert.equal(passive25.grossSalaryYear, 0);
  assert.equal(passive25.arbetsgivaravgift, 0);
  assert.equal(passive25.insurance, 0);
  assert.equal(passive25.dividendsLimit, Math.floor(Math.max(0.5 * 2.75 * 76200, passive25.omkostnadsbeloppInterest)));
  const r26 = calculateCompany(twoOwners(2026, {}, { employed: false }), fixtureData);
  const passive26 = r26.people[1];
  assert.equal(passive26.salaryBasedLimit, 0);
  assert.equal(passive26.dividendsLimit, 161200);
  assert.equal(r26.company.grossDividends, Math.min(2 * 161200, r26.company.profitAfterTax));
});

test('employee without shares: salary costs the company, no dividend', () => {
  const inputs = {
    year: 2026,
    company: single(BASE_INPUT).company,
    people: [person('p1', { ownershipPercent: 100 }), person('p2', { ownershipPercent: 0, grossSalaryMonth: 30000 })],
  };
  const r = calculateCompany(inputs, fixtureData);
  const alone = calculateCompany({ ...inputs, people: [inputs.people[0]] }, fixtureData);
  const emp = r.people[1];
  assert.equal(emp.grossDividends, 0);
  assert.ok(Number.isNaN(emp.dividendsLimit));
  assert.ok(Math.abs(r.company.totalCost - alone.company.totalCost - (emp.grossSalaryYear + emp.pension + emp.insurance + emp.slp + emp.arbetsgivaravgift)) < 1e-6);
  // The employee's salary counts in the owner's löneunderlag.
  assert.ok(r.people[0].salaryBasedLimit > alone.people[0].salaryBasedLimit);
});

test('ownership not adding up to 100 % gives no dividend', () => {
  const r = calculateCompany(twoOwners(2026, {}, { ownershipPercent: 40 }), fixtureData);
  assert.ok(Math.abs(r.company.ownershipSum - 0.9) < 1e-9);
  assert.ok(Number.isNaN(r.company.grossDividends));
  assert.ok(Number.isFinite(r.company.profitAfterTax));
});

test('manual total dividend is capped by the tightest owner', () => {
  const r = calculateCompany({ ...twoOwners(2026, {}, { employed: false }), company: { ...twoOwners(2026).company, maxDividend: false, grossDividends: 1e7 } }, fixtureData);
  assert.equal(r.company.grossDividends, r.company.dividendCap);
});

test('money is conserved across people', () => {
  for (const year of [2025, 2026]) {
    const r = calculateCompany(twoOwners(year, { grossSalaryMonth: 52000 }, { grossSalaryMonth: 31000, yearBorn: 1960 }), fixtureData);
    const c = r.company;
    const paidToPeople = r.people.reduce((s, f) => s + f.grossSalaryYear + f.pension + f.grossDividends, 0);
    const toState = c.arbetsgivaravgift + c.slp + c.bolagsTax;
    assert.ok(Math.abs(c.invoicedAmount + c.otherRevenue - c.otherCosts - c.insurance - paidToPeople - toState - c.profitAfterDividends) < 1e-6);
  }
});

test('salary sweep for the second person keeps the first person fixed', () => {
  const inputs = twoOwners(2026, { grossSalaryMonth: 60000 }, { grossSalaryMonth: 40000 });
  const s = companySalarySweep(inputs, 1, fixtureData);
  assert.ok(s.grossSalaryMonth.length > 10);
  assert.ok(s.netSalaryYear[20] > s.netSalaryYear[5]);
  assert.equal(companySalarySweep({ ...inputs, people: [inputs.people[0], { ...inputs.people[1], employed: false }] }, 1, fixtureData), null);
});
