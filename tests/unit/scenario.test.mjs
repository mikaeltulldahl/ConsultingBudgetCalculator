import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  defaultState, validateState, makeDocument, parseDocument, ScenarioFormatError,
  toEngineInputs, toCsv, isPristine, APP_ID, defaultPerson, autoOmkostnadsbelopp, revenueForState, isEmployed,
} from '../../js/scenario.js';
import { calculate, calculateCompany } from '../../js/engine.js';
import { defaultAssignment } from '../../js/assignments.js';
import { fixtureData } from '../helpers/data.mjs';
import { BASE_INPUT } from '../helpers/cases.mjs';

const kommunRates = JSON.parse(readFileSync(new URL('../../data/kommuner.json', import.meta.url), 'utf8'));

const sample = {
  ...defaultState(),
  people: [{ ...defaultPerson(), yearBorn: 1985, kommun: 'STOCKHOLM', churchMember: true, forsamling: 'ADOLF FREDRIKS FÖRSAMLING', kyrkoavgift: 1.18 }],
  assignments: [{ ...defaultAssignment(), billableHours: 1770 }],
};
const withPerson = (state, extra) => ({ ...state, people: [{ ...state.people[0], ...extra }, ...state.people.slice(1)] });

test('document round trip keeps state and scenarios', () => {
  const two = { ...sample, people: [{ ...sample.people[0], ownership: 60 }, { ...defaultPerson('p2'), name: 'Anna', ownership: 40, grossSalaryMonth: 0, yearBorn: 1990, kommun: 'SOLNA' }] };
  const scenarios = [{ name: 'Två', savedAt: null, state: two }, { name: '850 kr/h', savedAt: '2026-11-10T10:00:00.000Z', state: { ...sample, assignments: [{ ...defaultAssignment(), hourlyRate: 850, name: 'Kund A', priceChanges: [{ from: '2026-04-01', hourlyRate: 900, vacationDays: 3 }] }, { ...defaultAssignment('a2', 2026, 'p1'), startDate: '2026-07-01' }] } }];
  const json = JSON.stringify(makeDocument(sample, scenarios));
  const parsed = parseDocument(json);
  assert.deepEqual(parsed.current, sample);
  assert.deepEqual(parsed.scenarios, scenarios);
  assert.equal(parsed.invalid, 0);
});

test('unknown keys are dropped and bad values replaced by defaults', () => {
  const { state, invalid } = validateState({ ...sample, otherCosts: '700', evil: '<script>',
    assignments: [{ id: 'a1', hourlyRate: '700', startDate: 'yesterday', priceChanges: [{ from: 'x', hourlyRate: 900 }] }] });
  assert.equal(state.otherCosts, defaultState().otherCosts);
  assert.equal(state.assignments[0].hourlyRate, 700);
  assert.equal(state.assignments[0].startDate, defaultAssignment().startDate);
  assert.deepEqual(state.assignments[0].priceChanges, []);
  assert.ok(!('evil' in state));
  assert.equal(invalid, 4);
});

test('foreign or broken files are rejected with a readable message', () => {
  assert.throws(() => parseDocument('not json'), ScenarioFormatError);
  assert.throws(() => parseDocument({ app: 'Other', version: 1 }), /inte en export/);
  assert.throws(() => parseDocument({ app: APP_ID, version: 99 }), /nyare version/);
  assert.throws(() => parseDocument({ app: APP_ID, version: 'x' }), /okänt format/);
});

test('scenario names are cleaned and limited', () => {
  const doc = makeDocument(sample, [{ name: '   ', state: sample }, { name: 'x'.repeat(200), state: sample }]);
  const { scenarios } = parseDocument(doc);
  assert.equal(scenarios[0].name, 'Scenario 1');
  assert.equal(scenarios[1].name.length, 80);
});

// The engine inputs of a one-person state, flattened to calculate() inputs.
function flat(inputs) {
  const { ownershipPercent, employed, id, ...person } = inputs.people[0];
  return { year: inputs.year, ...inputs.company, ...person };
}

test('toEngineInputs gives the same result as the engine inputs used in the tests', () => {
  const state = withPerson(sample, { churchMember: false, forsamling: '', kyrkoavgift: null });
  const inputs = toEngineInputs(state, kommunRates);
  assert.equal(inputs.company.invoicedAmount, BASE_INPUT.invoicedAmount);
  assert.equal(calculateCompany(inputs, fixtureData).people[0].netSumMonth, calculate(BASE_INPUT, fixtureData).netSumMonth);
  const f = flat(inputs);
  for (const [k, v] of Object.entries(BASE_INPUT)) {
    if (k === 'churchSkattPercent') continue; // unused when not a member
    assert.equal(f[k], v, k);
  }
});

test('toEngineInputs uses the stored kyrkoavgift and computes hours from dates when empty', () => {
  const inputs = toEngineInputs({ ...sample, assignments: [defaultAssignment()] }, kommunRates);
  assert.equal(inputs.people[0].churchSkattPercent, 1.18);
  assert.equal(inputs.company.invoicedAmount, 700 * Math.round((251 - 25) * 8));
});

test("vacation applies to each person's own assignments", () => {
  const state = {
    ...sample,
    people: [sample.people[0], { ...defaultPerson('p2'), ownership: 0 }],
    assignments: [defaultAssignment('a1', 2026, 'p1'), { ...defaultAssignment('a2', 2026, 'p2'), vacationDays: 0 }],
  };
  const inputs = toEngineInputs(state, kommunRates);
  assert.equal(inputs.company.invoicedAmount, 700 * Math.round((251 - 25) * 8) + 700 * 251 * 8);
  assert.deepEqual(inputs.people.map((p) => p.vacationDays), [25, 0]);
});

test('vacation days per period: entered days are used, the rest is shared by the other periods', () => {
  const a = { ...defaultAssignment(), hourlyRate: 800, vacationDays: 5, priceChanges: [{ from: '2026-07-01', hourlyRate: 1000, vacationDays: null }] };
  const state = { ...sample, assignments: [a] };
  const r = revenueForState(state);
  assert.equal(r.vacationByPerson.p1, 25);
  const [first, second] = r.assignments[0].segments;
  assert.equal(first.vacationDays, 5);
  assert.ok(Math.abs(second.vacationDays - 20) < 1e-9);
  // Entering the days in both periods gives their sum, also to the salary calculation.
  a.priceChanges[0].vacationDays = 30;
  assert.equal(toEngineInputs(state, kommunRates).people[0].vacationDays, 35);
});

test('empty fields become NaN, unknown kommun gives no rates', () => {
  const inputs = toEngineInputs({ ...defaultState() }, kommunRates);
  assert.ok(Number.isNaN(inputs.people[0].yearBorn));
  assert.ok(Number.isNaN(inputs.people[0].kommunalSkattPercent));
});

test('pristine state is detected', () => {
  assert.ok(isPristine(defaultState()));
  assert.ok(isPristine({ ...defaultState(), grossDividends: null }), 'calculated dividend does not count');
  assert.ok(!isPristine({ ...defaultState(), maxDividend: false, grossDividends: 5 }));
  assert.ok(isPristine({ ...defaultState(), assignments: [{ ...defaultAssignment(), billableHours: 1808 }] }));
  assert.ok(!isPristine({ ...defaultState(), assignments: [{ ...defaultAssignment(), billableHours: 1000 }] }));
  assert.ok(!isPristine({ ...defaultState(), assignments: [defaultAssignment(), defaultAssignment('a2')] }));
  assert.ok(!isPristine(withPerson(defaultState(), { yearBorn: 1985 })));
  assert.ok(!isPristine({ ...defaultState(), people: [defaultPerson(), defaultPerson('p2')] }));
});

test('CSV uses semicolons, decimal comma, BOM and safe quoting', () => {
  const csv = toCsv([
    ['Fält', 'Värde'],
    ['Kommunal skatt (%)', 30.55],
    ['Text; med "citat"', -1500],
    ['=HYPERLINK("x")', null],
  ]);
  assert.ok(csv.startsWith('﻿'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], 'Fält;Värde');
  assert.equal(lines[1], 'Kommunal skatt (%);30,55');
  assert.equal(lines[2], '"Text; med ""citat""";-1500');
  assert.equal(lines[3], `"'=HYPERLINK(""x"")";`);
});

test('version 1 files (one assignment as separate fields) are converted', () => {
  const v1 = {
    app: APP_ID, version: 1, savedAt: '2026-11-01T00:00:00.000Z',
    current: { year: 2026, hourlyRate: 850, billingStartDate: '2026-02-01', billingEndDate: '2026-11-30', workingRate: 80,
      vacationDays: 20, billableHours: 1200, manualInvoicedAmount: 1000000, yearBorn: 1985, kommun: 'STOCKHOLM' },
    scenarios: [{ name: 'Gammal', state: { hourlyRate: 700 } }],
  };
  const { current, scenarios, invalid } = parseDocument(JSON.stringify(v1));
  assert.equal(invalid, 0);
  assert.deepEqual(current.assignments, [{ ...defaultAssignment(), hourlyRate: 850, startDate: '2026-02-01', endDate: '2026-11-30',
    workingRate: 80, billableHours: 1200, manualAmount: 1000000 }]);
  assert.equal(scenarios[0].state.assignments[0].hourlyRate, 700);
  assert.ok(!('hourlyRate' in current));
  // A version 1 file gives the same invoiced amount as before.
  assert.equal(toEngineInputs(current, kommunRates).company.invoicedAmount, 1000000);
});

test('version 2 files (one person at the top level) become person 1 with all the shares', () => {
  const v2 = {
    app: APP_ID, version: 2, savedAt: '2026-11-01T00:00:00.000Z',
    current: { year: 2025, yearBorn: 1985, kommun: 'STOCKHOLM', churchMember: true, forsamling: 'X', kyrkoavgift: 1.1,
      grossSalaryMonth: 60000, vacationDays: 30, otherEmployer: 'Kund C', otherSalaryYear: 100000, omkostnadsbelopp: 50000,
      otherCosts: 5000, maxDividend: false, grossDividends: 100000, pensionMode: 'amount', pensionAmount: 50000,
      assignments: [{ id: 'a1', hourlyRate: 900 }] },
    scenarios: [],
  };
  const { current, invalid } = parseDocument(v2);
  assert.equal(invalid, 0);
  assert.deepEqual(current.people, [{ ...defaultPerson(), yearBorn: 1985, kommun: 'STOCKHOLM', churchMember: true, forsamling: 'X',
    kyrkoavgift: 1.1, grossSalaryMonth: 60000, otherEmployer: 'Kund C', otherSalaryYear: 100000,
    omkostnadsbelopp: 50000, pensionMode: 'amount', pensionAmount: 50000 }]);
  assert.equal(current.year, 2025);
  assert.equal(current.otherCosts, 5000);
  assert.equal(current.maxDividend, false);
  assert.equal(current.grossDividends, 100000);
  assert.equal(current.assignments[0].person, 'p1');
  assert.ok(!('yearBorn' in current));
});

test('assignments of a person who does not exist go to the first person', () => {
  const { state } = validateState({ people: [{ id: 'p7' }], assignments: [{ id: 'a1', person: 'p3' }] });
  assert.equal(state.people[0].id, 'p7');
  assert.equal(state.assignments[0].person, 'p7');
});

test('assignment and person ids are kept unique', () => {
  const { state } = validateState({ assignments: [{ id: 'a1' }, { id: 'a1' }, { id: 'BAD ID' }], people: [{ id: 'p1' }, { id: 'p1' }] });
  assert.deepEqual(state.assignments.map((a) => a.id), ['a1', 'a2', 'a3']);
  assert.deepEqual(state.people.map((p) => p.id), ['p1', 'p2']);
});


test('omkostnadsbelopp follows the ownership until a value is entered', () => {
  assert.equal(autoOmkostnadsbelopp(100), 25000);
  assert.equal(autoOmkostnadsbelopp(40), 10000);
  const state = defaultState();
  state.people = [{ ...defaultPerson('p1'), ownership: 60 }, { ...defaultPerson('p2'), ownership: 40, omkostnadsbelopp: 99, omkostnadsbeloppAuto: false }];
  const [a, b] = toEngineInputs(state, fixtureData).people;
  assert.equal(a.omkostnadsbelopp, 15000);
  assert.equal(b.omkostnadsbelopp, 99);
});

test('a person without salary from the company is not employed', () => {
  assert.equal(isEmployed(defaultPerson()), true);
  assert.equal(isEmployed({ ...defaultPerson(), grossSalaryMonth: 0 }), false);
  assert.equal(isEmployed({ ...defaultPerson(), salaryMonths: 0 }), false);
  assert.equal(isEmployed({ ...defaultPerson(), grossSalaryMonth: 0, salaryMode: 'brytpunkt' }), true);
  assert.equal(isEmployed({ ...defaultPerson(), grossSalaryMonth: null }), true, 'an empty field is not 0');
  const state = { ...sample, people: [{ ...sample.people[0], ownership: 50 }, { ...defaultPerson('p2'), ownership: 50, grossSalaryMonth: 0 }] };
  assert.deepEqual(toEngineInputs(state, kommunRates).people.map((p) => p.employed), [true, false]);
});

test('salary mode: brytpunkt goes to the engine, other modes and bad values are kept apart', () => {
  const state = { ...sample, people: [{ ...sample.people[0], salaryMode: 'brytpunkt' }] };
  assert.equal(toEngineInputs(state, kommunRates).people[0].useMaxGrossSalary, true);
  assert.equal(toEngineInputs({ ...sample, people: [{ ...sample.people[0], salaryMode: 'maxNet' }] }, kommunRates).people[0].useMaxGrossSalary, false);
  const { state: loaded, invalid } = validateState({ people: [{ id: 'p1', salaryMode: 'nonsense' }] });
  assert.equal(loaded.people[0].salaryMode, 'manual');
  assert.equal(invalid, 1);
});
