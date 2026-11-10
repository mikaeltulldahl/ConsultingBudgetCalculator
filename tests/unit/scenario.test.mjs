import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  defaultState, validateState, makeDocument, parseDocument, ScenarioFormatError,
  toEngineInputs, toCsv, isPristine, APP_ID,
} from '../../js/scenario.js';
import { calculate } from '../../js/engine.js';
import { defaultAssignment } from '../../js/assignments.js';
import { fixtureData } from '../helpers/data.mjs';
import { BASE_INPUT } from '../helpers/cases.mjs';

const kommunRates = JSON.parse(readFileSync(new URL('../../data/kommuner.json', import.meta.url), 'utf8'));

const sample = {
  ...defaultState(),
  yearBorn: 1985,
  kommun: 'STOCKHOLM',
  assignments: [{ ...defaultAssignment(), billableHours: 1770 }],
  churchMember: true,
  forsamling: 'ADOLF FREDRIKS FÖRSAMLING',
  kyrkoavgift: 1.18,
};

test('document round trip keeps state and scenarios', () => {
  const scenarios = [{ name: '850 kr/h', savedAt: '2026-11-10T10:00:00.000Z', state: { ...sample, assignments: [{ ...defaultAssignment(), hourlyRate: 850, name: 'Kund A', priceChanges: [{ from: '2026-04-01', hourlyRate: 900 }] }, { ...defaultAssignment('a2'), startDate: '2026-07-01' }] } }];
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

test('toEngineInputs gives the same result as the engine inputs used in the tests', () => {
  const state = { ...sample, churchMember: false, forsamling: '', kyrkoavgift: null };
  const inputs = toEngineInputs(state, kommunRates);
  assert.equal(inputs.invoicedAmount, BASE_INPUT.invoicedAmount);
  assert.deepEqual(calculate(inputs, fixtureData).netSumMonth, calculate(BASE_INPUT, fixtureData).netSumMonth);
  for (const [k, v] of Object.entries(BASE_INPUT)) {
    if (k === 'churchSkattPercent') continue; // unused when not a member
    assert.equal(inputs[k], v, k);
  }
});

test('toEngineInputs uses the stored kyrkoavgift and computes hours from dates when empty', () => {
  const inputs = toEngineInputs({ ...sample, assignments: [defaultAssignment()] }, kommunRates);
  assert.equal(inputs.churchSkattPercent, 1.18);
  assert.equal(inputs.invoicedAmount, 700 * Math.round((251 - 25) * 8));
});

test('empty fields become NaN, unknown kommun gives no rates', () => {
  const inputs = toEngineInputs({ ...defaultState() }, kommunRates);
  assert.ok(Number.isNaN(inputs.yearBorn));
  assert.ok(Number.isNaN(inputs.kommunalSkattPercent));
});

test('pristine state is detected', () => {
  assert.ok(isPristine(defaultState()));
  assert.ok(isPristine({ ...defaultState(), assignments: [{ ...defaultAssignment(), billableHours: 1808 }] }));
  assert.ok(!isPristine({ ...defaultState(), assignments: [{ ...defaultAssignment(), billableHours: 1000 }] }));
  assert.ok(!isPristine({ ...defaultState(), assignments: [defaultAssignment(), defaultAssignment('a2')] }));
  assert.ok(!isPristine({ ...defaultState(), yearBorn: 1985 }));
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
  assert.equal(current.vacationDays, 20);
  assert.equal(scenarios[0].state.assignments[0].hourlyRate, 700);
  assert.ok(!('hourlyRate' in current));
  // A version 1 file gives the same invoiced amount as before.
  assert.equal(toEngineInputs(current, kommunRates).invoicedAmount, 1000000);
});

test('assignment ids are kept unique', () => {
  const { state } = validateState({ assignments: [{ id: 'a1' }, { id: 'a1' }, { id: 'BAD ID' }] });
  assert.deepEqual(state.assignments.map((a) => a.id), ['a1', 'a2', 'a3']);
});
