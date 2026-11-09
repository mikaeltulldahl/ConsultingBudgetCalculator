// Regression test: the engine output for a fixed grid of inputs must not change by accident.
// After an intentional change to the maths, run `npm run update-snapshots` and review the
// diff of tests/regression/snapshot.json before committing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeSnapshot, SNAPSHOT_FILE } from './snapshot.mjs';

test('engine output matches stored snapshot', () => {
  const expected = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'));
  const actual = JSON.parse(JSON.stringify(computeSnapshot()));
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    assert.deepStrictEqual(actual[i], expected[i], `case ${i}: ${JSON.stringify(expected[i].input)}`);
  }
});
