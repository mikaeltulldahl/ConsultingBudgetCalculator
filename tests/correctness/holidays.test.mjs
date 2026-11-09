// Locally computed holidays must match the public holiday API previously used by the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { swedishHolidays, businessDays, easterSunday } from '../../js/holidays.js';

const nager = JSON.parse(readFileSync(new URL('../fixtures/holidays-nager.json', import.meta.url), 'utf8'));

for (const [year, expected] of Object.entries(nager.holidays)) {
  test(`holidays ${year} match date.nager.at`, () => {
    assert.deepEqual(swedishHolidays(Number(year)).map((h) => [h.date, h.name]), expected);
  });
}

test('easter dates', () => {
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  assert.equal(iso(easterSunday(2024)), '2024-03-31');
  assert.equal(iso(easterSunday(2025)), '2025-04-20');
  assert.equal(iso(easterSunday(2038)), '2038-04-25');
});

test('business days', () => {
  // 2026: 261 weekdays, minus 10 holidays on weekdays.
  assert.equal(businessDays('2026-01-01', '2026-12-31'), 251);
  assert.equal(businessDays('2026-04-01', '2026-04-10'), 6); // Långfredag + Annandag påsk
  assert.equal(businessDays('2026-01-03', '2026-01-04'), 0); // weekend
  assert.equal(businessDays('2026-12-31', '2027-01-01'), 0); // nyårsafton, nyårsdagen
  assert.equal(businessDays('2026-05-02', '2026-05-01'), 0); // end before start
  assert.equal(businessDays(new Date(2026, 0, 5), new Date(2026, 0, 9)), 4); // Date objects
});
