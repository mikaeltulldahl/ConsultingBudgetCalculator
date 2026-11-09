// Proves the engine produces exactly the same numbers as the original calculator code
// (frozen in tools/legacy/legacy-calc.js), for every output field and every chart point.
// Intentional changes to the maths are listed in KNOWN_DIFFERENCES with a reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLegacy } from '../../tools/legacy/run-legacy.mjs';
import { calculate, salarySweep } from '../../js/engine.js';
import { fixtureData } from '../helpers/data.mjs';
import { generateCases, BASE_INPUT } from '../helpers/cases.mjs';

// Each entry: { reason, applies(input) -> bool, fields: [...] } – fields to skip for
// inputs where the engine deliberately differs from the legacy code.
export const KNOWN_DIFFERENCES = [];

function skipped(input) {
  return new Set(KNOWN_DIFFERENCES.filter((d) => d.applies(input)).flatMap((d) => d.fields));
}

function compare(input, legacy, engine) {
  const skip = skipped(input);
  for (const [key, value] of Object.entries(legacy.result)) {
    if (skip.has(key)) continue;
    assert.ok(Object.is(engine.result[key], value),
      `${key}: legacy ${value} vs engine ${engine.result[key]}\ninput ${JSON.stringify(input)}`);
  }
  if (skip.has('sweep')) return;
  assert.deepStrictEqual(engine.sweep, legacy.sweep, `sweep differs for input ${JSON.stringify(input)}`);
}

const cases = [BASE_INPUT, ...generateCases(400)];

test(`engine matches legacy calculator for ${cases.length} cases`, async () => {
  for (const input of cases) {
    const legacy = await runLegacy(input);
    const result = calculate(input, fixtureData);
    const sweep = salarySweep(result, fixtureData);
    compare(input, legacy, { result, sweep });
  }
});
