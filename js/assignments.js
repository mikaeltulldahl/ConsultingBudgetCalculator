// Assignments (uppdrag): billable hours and invoiced amount per assignment, with price
// changes during the period. Pure functions, no DOM.
import { businessDays } from './holidays.js';

const DAY = 24 * 60 * 60 * 1000;
const toUTC = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const toISO = (t) => new Date(t).toISOString().slice(0, 10);

export function defaultAssignment(id = 'a1', year = 2026, person = 'p1') {
  return {
    id,
    person, // who works on the assignment (a person id)
    name: '',
    hourlyRate: 700,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    workingRate: 100,
    billableHours: null, // null = computed from the period
    manualAmount: null, // null = hours × rate
    priceChanges: [], // [{ from: 'YYYY-MM-DD', hourlyRate }]
  };
}

// Periods with one hourly rate each: from the start (initial rate) and from each price
// change that falls inside the assignment. Sorted, clipped to the assignment.
export function priceSegments(a) {
  if (!a.startDate || !a.endDate || toUTC(a.endDate) < toUTC(a.startDate)) return [];
  const start = toUTC(a.startDate);
  const end = toUTC(a.endDate);
  const changes = (a.priceChanges ?? [])
    .filter((c) => c.from && Number.isFinite(c.hourlyRate) && toUTC(c.from) > start && toUTC(c.from) <= end)
    .sort((x, y) => toUTC(x.from) - toUTC(y.from));
  const segments = [];
  let from = start;
  let rate = a.hourlyRate;
  for (const c of changes) {
    const at = toUTC(c.from);
    if (at > from) segments.push({ from: toISO(from), to: toISO(at - DAY), hourlyRate: rate });
    from = at;
    rate = c.hourlyRate;
  }
  segments.push({ from: toISO(from), to: toISO(end), hourlyRate: rate });
  return segments.map((s) => ({ ...s, days: businessDays(s.from, s.to) }));
}

// Billable hours and invoiced amount for all assignments.
// Vacation days are spread over all assignments' periods in proportion to their working
// days. Hours per period: (working days − vacation share) × 8 × working rate, rounded to
// whole hours. A manual number of hours is spread over the periods like the computed
// hours; a manual amount replaces the computed amount.
export function assignmentRevenue(assignments, vacationDays) {
  const segmented = assignments.map((a) => ({ a, segments: priceSegments(a) }));
  const totalDays = segmented.reduce((sum, x) => sum + x.segments.reduce((s, seg) => s + seg.days, 0), 0);
  const vacation = Number.isFinite(vacationDays) ? vacationDays : 0;
  const result = segmented.map(({ a, segments }) => {
    const working = Number.isFinite(a.workingRate) ? a.workingRate : 0;
    for (const seg of segments) {
      const share = totalDays > 0 ? vacation * seg.days / totalDays : 0;
      seg.hours = Math.round(Math.max(0, seg.days - share) * 8 * working * 0.01);
    }
    const computedHours = segments.reduce((s, seg) => s + seg.hours, 0);
    let hours = computedHours;
    if (Number.isFinite(a.billableHours)) {
      hours = a.billableHours;
      for (const seg of segments) {
        seg.hours = computedHours > 0 ? hours * seg.hours / computedHours : (seg === segments[0] ? hours : 0);
      }
    }
    const rate = Number.isFinite(a.hourlyRate) ? a.hourlyRate : NaN;
    const computedAmount = segments.length && !isNaN(rate)
      ? segments.reduce((s, seg) => s + seg.hours * (Number.isFinite(seg.hourlyRate) ? seg.hourlyRate : 0), 0)
      : 0;
    const amount = Number.isFinite(a.manualAmount) ? a.manualAmount : computedAmount;
    return { id: a.id, computedHours, hours, computedAmount, amount, segments };
  });
  return {
    assignments: result,
    totalHours: result.reduce((s, r) => s + r.hours, 0),
    total: result.reduce((s, r) => s + r.amount, 0),
  };
}

// Several people: each person's vacation is spread over the assignments that person works
// on. vacationFor(personId) gives that person's vacation days. Results keep the order of
// `assignments`.
export function assignmentRevenueByPerson(assignments, vacationFor) {
  const groups = new Map();
  for (const a of assignments) {
    if (!groups.has(a.person)) groups.set(a.person, []);
    groups.get(a.person).push(a);
  }
  const byId = new Map();
  for (const [person, list] of groups) {
    for (const r of assignmentRevenue(list, vacationFor(person)).assignments) byId.set(r.id, r);
  }
  const result = assignments.map((a) => byId.get(a.id));
  return {
    assignments: result,
    totalHours: result.reduce((s, r) => s + r.hours, 0),
    total: result.reduce((s, r) => s + r.amount, 0),
  };
}
