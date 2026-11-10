import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignmentRevenue, defaultAssignment, priceSegments } from '../../js/assignments.js';
import { billableHours } from '../../js/engine.js';

test('one assignment without price change gives the same as before', () => {
  for (const [start, end, working, vacation, rate] of [
    ['2026-01-01', '2026-12-31', 100, 25, 700],
    ['2026-03-15', '2026-11-30', 80, 10, 925],
    ['2025-01-01', '2025-06-30', 50, 0, 1100],
    ['2026-01-01', '2026-01-10', 100, 30, 800], // more vacation than working days
  ]) {
    const a = { ...defaultAssignment(), startDate: start, endDate: end, workingRate: working, hourlyRate: rate };
    const r = assignmentRevenue([a], vacation);
    const oldHours = billableHours({ startDate: start, endDate: end, workingRatePercent: working, vacationDays: vacation });
    assert.equal(r.totalHours, oldHours, `${start}..${end}`);
    assert.equal(r.total, rate * oldHours);
  }
});

test('price change on 1 April splits the year', () => {
  const a = { ...defaultAssignment(), hourlyRate: 850, priceChanges: [{ from: '2026-04-01', hourlyRate: 900 }] };
  const seg = priceSegments(a);
  assert.deepEqual(seg.map((s) => [s.from, s.to, s.hourlyRate]), [['2026-01-01', '2026-03-31', 850], ['2026-04-01', '2026-12-31', 900]]);
  assert.equal(seg[0].days + seg[1].days, 251);
  const r = assignmentRevenue([a], 25).assignments[0];
  assert.equal(r.amount, 850 * r.segments[0].hours + 900 * r.segments[1].hours);
  // Vacation spread in proportion to working days.
  const share = 25 * seg[0].days / 251;
  assert.equal(r.segments[0].hours, Math.round((seg[0].days - share) * 8));
});

test('price changes outside the period are ignored and unsorted changes are sorted', () => {
  const a = { ...defaultAssignment(), startDate: '2026-02-01', endDate: '2026-10-31', priceChanges: [
    { from: '2026-09-01', hourlyRate: 950 }, { from: '2026-05-01', hourlyRate: 900 }, { from: '2027-01-01', hourlyRate: 2000 }, { from: '2026-01-15', hourlyRate: 1 },
  ] };
  assert.deepEqual(priceSegments(a).map((s) => s.hourlyRate), [700, 900, 950]);
});

test('vacation is spread over several assignments', () => {
  const a1 = { ...defaultAssignment('a1'), endDate: '2026-06-30' };
  const a2 = { ...defaultAssignment('a2'), startDate: '2026-07-01', hourlyRate: 1000 };
  const r = assignmentRevenue([a1, a2], 25);
  const days = r.assignments.map((x) => x.segments[0].days);
  assert.equal(days[0] + days[1], 251);
  assert.equal(r.assignments[0].hours, Math.round((days[0] - 25 * days[0] / 251) * 8));
  assert.equal(r.total, 700 * r.assignments[0].hours + 1000 * r.assignments[1].hours);
});

test('manual hours and manual amount override the computed values', () => {
  const a = { ...defaultAssignment(), hourlyRate: 800, priceChanges: [{ from: '2026-07-01', hourlyRate: 1000 }], billableHours: 1000 };
  const r = assignmentRevenue([a], 25).assignments[0];
  assert.equal(r.hours, 1000);
  assert.ok(Math.abs(r.segments[0].hours + r.segments[1].hours - 1000) < 1e-9);
  assert.ok(r.amount > 800 * 1000 && r.amount < 1000 * 1000);
  const m = assignmentRevenue([{ ...a, manualAmount: 1234567 }], 25);
  assert.equal(m.total, 1234567);
});

test('empty or reversed periods give zero', () => {
  assert.equal(assignmentRevenue([{ ...defaultAssignment(), endDate: '2025-12-31' }], 0).total, 0);
  assert.equal(assignmentRevenue([{ ...defaultAssignment(), startDate: '' }], 0).total, 0);
  assert.equal(assignmentRevenue([], 25).total, 0);
});
