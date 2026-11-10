import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  defaultState, validateState, makeDocument, parseDocument, ScenarioFormatError,
  toEngineInputs, toCsv, isPristine, APP_ID,
} from '../../js/scenario.js';
import { calculate } from '../../js/engine.js';
import { fixtureData } from '../helpers/data.mjs';
import { BASE_INPUT } from '../helpers/cases.mjs';

const kommunRates = JSON.parse(readFileSync(new URL('../../data/kommuner.json', import.meta.url), 'utf8'));

const sample = {
  ...defaultState(),
  yearBorn: 1985,
  kommun: 'STOCKHOLM',
  billableHours: 1770,
  churchMember: true,
  forsamling: 'ADOLF FREDRIKS FÖRSAMLING',
  kyrkoavgift: 1.18,
};

test('document round trip keeps state and scenarios', () => {
  const scenarios = [{ name: '850 kr/h', savedAt: '2026-11-10T10:00:00.000Z', state: { ...sample, hourlyRate: 850 } }];
  const json = JSON.stringify(makeDocument(sample, scenarios));
  const parsed = parseDocument(json);
  assert.deepEqual(parsed.current, sample);
  assert.deepEqual(parsed.scenarios, scenarios);
  assert.equal(parsed.invalid, 0);
});

test('unknown keys are dropped and bad values replaced by defaults', () => {
  const { state, invalid } = validateState({ ...sample, hourlyRate: '700', evil: '<script>', billingStartDate: 'yesterday' });
  assert.equal(state.hourlyRate, defaultState().hourlyRate);
  assert.equal(state.billingStartDate, defaultState().billingStartDate);
  assert.ok(!('evil' in state));
  assert.equal(invalid, 2);
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
  const inputs = toEngineInputs({ ...sample, billableHours: null }, kommunRates);
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
  assert.ok(isPristine({ ...defaultState(), billableHours: 1808 }));
  assert.ok(!isPristine({ ...defaultState(), billableHours: 1000 }));
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
