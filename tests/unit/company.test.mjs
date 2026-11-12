// A company with several people: owners and/or employees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, calculateCompany, companySalarySweep, companyGroupSweep, dividendLimit, salarySweep } from '../../js/engine.js';
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

test('shares below 100 %: the rest belongs to other owners, who get their dividend per share', () => {
  const r = calculateCompany(twoOwners(2026, {}, { ownershipPercent: 40 }), fixtureData);
  const c = r.company;
  const [p1, p2] = r.people;
  assert.ok(Math.abs(c.ownershipSum - 0.9) < 1e-9);
  assert.ok(Math.abs(c.otherOwnersShare - 0.1) < 1e-9);
  assert.equal(c.dividendCap, Math.min(p1.dividendsLimit / 0.5, p2.dividendsLimit / 0.4));
  assert.equal(c.grossDividends, Math.max(0, Math.min(c.dividendCap, c.profitAfterTax)));
  assert.ok(Math.abs(p1.grossDividends + p2.grossDividends + c.otherOwnersDividends - c.grossDividends) < 1e-6);
  assert.ok(Math.abs(c.otherOwnersDividends - 0.1 * c.grossDividends) < 1e-6);
  // Only the people in the calculation pay dividend tax here.
  assert.ok(Math.abs(c.dividendTax - 0.2 * (p1.grossDividends + p2.grossDividends)) < 1e-6);
  // One person owning 60 %: 40 % of the dividend goes to others.
  const one = calculateCompany(single({ ...BASE_INPUT }), fixtureData);
  const sixty = calculateCompany({ ...single(BASE_INPUT), people: [{ ...single(BASE_INPUT).people[0], ownershipPercent: 60 }] }, fixtureData);
  assert.ok(sixty.people[0].grossDividends > 0 && sixty.company.otherOwnersDividends > 0);
  assert.equal(one.company.otherOwnersShare, 0);
  assert.equal(one.company.otherOwnersDividends, 0);
});

test('shares above 100 %, a share outside 0–100 %, or no owner in the calculation, give no dividend', () => {
  for (const r of [
    calculateCompany(twoOwners(2026, {}, { ownershipPercent: 60 }), fixtureData),
    calculateCompany(twoOwners(2026, { ownershipPercent: 0 }, { ownershipPercent: 0 }), fixtureData),
    // A share outside 0–100 % is wrong even if the total is 100 %.
    calculateCompany(twoOwners(2026, { ownershipPercent: 150 }, { ownershipPercent: -50 }), fixtureData),
  ]) {
    assert.ok(Number.isNaN(r.company.grossDividends));
    assert.ok(Number.isFinite(r.company.profitAfterTax));
  }
});

test('manual total dividend is capped by the tightest owner', () => {
  const r = calculateCompany({ ...twoOwners(2026, {}, { employed: false }), company: { ...twoOwners(2026).company, maxDividend: false, grossDividends: 1e7 } }, fixtureData);
  assert.equal(r.company.grossDividends, r.company.dividendCap);
});

test('money is conserved across people', () => {
  for (const year of [2025, 2026]) {
    const r = calculateCompany(twoOwners(year, { grossSalaryMonth: 52000 }, { grossSalaryMonth: 31000, yearBorn: 1960, ownershipPercent: 30 }), fixtureData);
    const c = r.company;
    const paidToPeople = r.people.reduce((s, f) => s + f.grossSalaryYear + f.pension + f.grossDividends, 0) + c.otherOwnersDividends;
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

test('salary sweep: the parts of the chart add up to the same total at every salary', () => {
  // 30 % of the shares belong to someone outside the calculation.
  const inputs = twoOwners(2026, { grossSalaryMonth: 60000 }, { grossSalaryMonth: 40000, ownershipPercent: 20 });
  inputs.people[0].ownershipPercent = 50;
  const s = companySalarySweep(inputs, 1, fixtureData);
  assert.ok(s.otherOwnersDividends.some((v) => v > 0));
  const totals = s.grossSalaryMonth.map((_, i) => s.netSalaryYear[i] + s.netDividends[i] + s.pension[i] + s.otherOwnersDividends[i]
    + s.profitAfterDividends[i] + s.totalTax[i] + s.bolagsTaxExclDividends[i]);
  for (const t of totals) assert.ok(Math.abs(t - totals[0]) <= 4, `${t} vs ${totals[0]}`);
});

test('spouses in the same company share one 8 inkomstbasbelopp deduction (2026)', () => {
  const salary = { grossSalaryMonth: 40000, useSemesterersattning: false, vacationDays: 0 };
  const apart = calculateCompany(twoOwners(2026, salary, salary), fixtureData);
  const married = calculateCompany(twoOwners(2026, { ...salary, spouseOf: 'p2' }, salary), fixtureData);
  const total = married.people[0].grossSalaryYear + married.people[1].grossSalaryYear;
  const joint = 0.5 * (total - 8 * 80600);
  // Each owner's half is not enough to pass 8 inkomstbasbelopp on its own, together it is.
  assert.equal(apart.people[0].salaryBasedLimit, 0.5 * Math.max(0, 0.5 * total - 8 * 80600));
  assert.ok(Math.abs(married.people[0].salaryBasedLimit - joint / 2) < 1e-6);
  assert.ok(married.people[0].salaryBasedLimit > apart.people[0].salaryBasedLimit);
  // The link works from either side.
  const reverse = calculateCompany(twoOwners(2026, salary, { ...salary, spouseOf: 'p1' }), fixtureData);
  assert.deepEqual(reverse.people.map((f) => f.dividendsLimit), married.people.map((f) => f.dividendsLimit));
});

test('shares in other companies reduce the grundbelopp here (2026)', () => {
  const alone = calculateCompany(twoOwners(2026, { ownershipPercent: 100 }, { ownershipPercent: 0 }), fixtureData);
  const elsewhere = calculateCompany(twoOwners(2026, { ownershipPercent: 100, ownershipElsewherePercent: 100 }, { ownershipPercent: 0 }), fixtureData);
  assert.equal(elsewhere.people[0].grundbelopp, alone.people[0].grundbelopp / 2);
});

test('group salary sweep: people who move together get the salary times their weight', () => {
  const inputs = twoOwners(2026, { grossSalaryMonth: 30000 }, { grossSalaryMonth: 30000 });
  const equal = companyGroupSweep(inputs, [{ index: 0, weight: 1 }, { index: 1, weight: 1 }], fixtureData, 500);
  const half = companyGroupSweep(inputs, [{ index: 0, weight: 1 }, { index: 1, weight: 0.5 }], fixtureData, 500);
  assert.ok(equal.grossSalaryMonth.length > 10);
  // Twice the people on the payroll hit the company's limit at a lower salary.
  assert.ok(equal.grossSalaryMonth.at(-1) < half.grossSalaryMonth.at(-1));
  // One person in the group is the same as the single sweep.
  assert.deepEqual(companyGroupSweep(inputs, [{ index: 1, weight: 1 }], fixtureData), companySalarySweep(inputs, 1, fixtureData));
  assert.equal(companyGroupSweep(inputs, [], fixtureData), null);
});

test('one owner through a holding company: same dividend to the person, the rest stays in the holding', () => {
  const direct = calculateCompany(single(BASE_INPUT), fixtureData);
  const viaInputs = single(BASE_INPUT);
  viaInputs.people[0].viaHolding = true;
  const via = calculateCompany(viaInputs, fixtureData);
  assert.equal(via.people[0].dividendsLimit, direct.people[0].dividendsLimit);
  assert.equal(via.people[0].grossDividends, direct.people[0].grossDividends);
  assert.equal(via.people[0].netSumMonth, direct.people[0].netSumMonth);
  assert.equal(via.company.totalTax, direct.company.totalTax);
  assert.equal(via.company.profitAfterDividends, direct.company.profitAfterDividends);
  // All profit after tax goes up to the holding; what the owner cannot take out waits there.
  assert.equal(via.company.dividendFromCompany, via.company.profitAfterTax);
  assert.ok(Math.abs(via.company.keptInHoldings - (via.company.profitAfterTax - via.people[0].grossDividends)) < 1e-6);
});

test('partners with a holding each get a full grundbelopp but no lönebaserat utrymme from a joint company (2026)', () => {
  const make = (viaHolding) => twoOwners(2026, { ownershipPercent: 25, grossSalaryMonth: 50000, viaHolding }, { ownershipPercent: 25, grossSalaryMonth: 50000, viaHolding });
  const direct = calculateCompany(make(false), fixtureData);
  const held = calculateCompany(make(true), fixtureData);
  assert.equal(held.people[0].grundbelopp, 4 * 80600);
  assert.equal(direct.people[0].grundbelopp, 0.25 * 4 * 80600);
  assert.equal(held.people[0].salaryBasedLimit, 0, 'a 25 % company is not a dotterföretag');
  assert.ok(held.people[0].dividendsLimit > direct.people[0].dividendsLimit - direct.people[0].salaryBasedLimit);
});

test('a holding that owns more than half counts the subsidiary\'s wages in proportion to its share (2026)', () => {
  const r = calculateCompany(twoOwners(2026, { ownershipPercent: 60, grossSalaryMonth: 90000, viaHolding: true }, { ownershipPercent: 40, grossSalaryMonth: 60000 }), fixtureData);
  const total = r.company.grossSalaryYear;
  const expected = Math.min(0.5 * Math.max(0, 0.6 * total - 8 * 80600), 50 * r.people[0].grossSalaryYear);
  assert.ok(Math.abs(r.people[0].salaryBasedLimit - expected) < 1e-6);
  // The direct owner still sets the cap on the company's dividend.
  assert.equal(r.company.limitingOwner, 'p2');
});

test('money is conserved with holding companies', () => {
  for (const year of [2025, 2026]) {
    const r = calculateCompany(twoOwners(year, { grossSalaryMonth: 52000, ownershipPercent: 40, viaHolding: true }, { grossSalaryMonth: 31000, ownershipPercent: 30 }), fixtureData);
    const c = r.company;
    const paidToPeople = r.people.reduce((s, f) => s + f.grossSalaryYear + f.pension + f.grossDividends, 0) + c.otherOwnersDividends;
    const toState = c.arbetsgivaravgift + c.slp + c.bolagsTax;
    assert.ok(Math.abs(c.invoicedAmount + c.otherRevenue - c.otherCosts - c.insurance - paidToPeople - toState - c.profitAfterDividends) < 1e-6);
  }
});

test('holding company costs and other income: tax at bolagsskatt, costs paid before the owner takes dividend', () => {
  const make = (holding) => { const x = single({ ...BASE_INPUT, invoicedAmount: 2400000 }); x.year = 2026; x.people[0] = { ...x.people[0], viaHolding: true, ...holding }; return x; };
  const base = calculateCompany(make({}), fixtureData).people[0];
  const withIncome = calculateCompany(make({ holdingIncome: 100000, holdingCosts: 20000 }), fixtureData).people[0];
  assert.ok(Math.abs(withIncome.holdingTax - 0.206 * 80000) < 1e-6);
  assert.ok(Math.abs(withIncome.keptInHolding - (base.keptInHolding + 80000 - withIncome.holdingTax)) < 1e-6);
  assert.equal(withIncome.grossDividends, base.grossDividends, 'the owner still takes the same within the limit');
  // Costs but no income give no tax back, and are paid from the dividend.
  const costs = calculateCompany(make({ holdingCosts: 15000 }), fixtureData).people[0];
  assert.equal(costs.holdingTax, 0);
  assert.ok(Math.abs(costs.keptInHolding - (base.keptInHolding - 15000)) < 1e-6);
  // Without money the holding cannot pay its costs and the owner gets nothing.
  const broke = calculateCompany(make({ holdingCosts: 1e9 }), fixtureData).people[0];
  assert.equal(broke.grossDividends, 0);
  assert.ok(broke.keptInHolding < 0);
});

test('money is conserved with holding costs and income', () => {
  const r = calculateCompany(twoOwners(2026, { grossSalaryMonth: 52000, ownershipPercent: 40, viaHolding: true, holdingCosts: 12000, holdingIncome: 50000 }, { grossSalaryMonth: 31000, ownershipPercent: 30 }), fixtureData);
  const c = r.company;
  const paidToPeople = r.people.reduce((s, f) => s + f.grossSalaryYear + f.pension + f.grossDividends, 0) + c.otherOwnersDividends;
  const toState = c.arbetsgivaravgift + c.slp + c.bolagsTax;
  const left = c.invoicedAmount + c.otherRevenue - c.otherCosts - c.insurance - paidToPeople - toState;
  // What is left of the profit, plus the holding's income, costs and tax.
  assert.ok(Math.abs(left - c.retainedFromProfit) < 1e-6);
  assert.ok(Math.abs(c.profitAfterDividends - (c.retainedFromProfit + 50000 - 12000 - c.holdingTax)) < 1e-6);
  assert.ok(Math.abs(c.holdingTax - 0.206 * 38000) < 1e-6);
});
