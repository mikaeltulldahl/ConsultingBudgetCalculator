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
    vacationDays: null, // working days off in the first price period; null = calculated
    priceChanges: [], // [{ from: 'YYYY-MM-DD', hourlyRate, vacationDays (null = calculated) }]
  };
}

// Vacation days a person has per year. Periods without an entered number share what is
// left of this, in proportion to their working days.
export const VACATION_DAYS = 25;

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
  let entered = a.vacationDays; // the vacation days entered for the period being built
  let source = null; // the price change that starts the period (null: the start)
  for (const c of changes) {
    const at = toUTC(c.from);
    if (at > from) segments.push({ from: toISO(from), to: toISO(at - DAY), hourlyRate: rate, entered, source });
    from = at;
    rate = c.hourlyRate;
    entered = c.vacationDays;
    source = c;
  }
  segments.push({ from: toISO(from), to: toISO(end), hourlyRate: rate, entered, source });
  return segments.map((s) => ({ ...s, days: businessDays(s.from, s.to) }));
}

// Billable hours and invoiced amount for all assignments of one person.
// Every price period (the start and each price change) has its own vacation days. Periods
// without an entered number share what is left of `vacationDays` (the person's year),
// in proportion to their working days. Hours per period: (working days − vacation) × 8 ×
// working rate, rounded to whole hours. A manual number of hours is spread over the
// periods like the computed hours; a manual amount replaces the computed amount.
// Each result has `vacationDays`, the sum over its periods; each period has `vacationDays`
// and `calculatedVacation` (what it gets when nothing is entered).
export function assignmentRevenue(assignments, vacationDays = VACATION_DAYS) {
  const segmented = assignments.map((a) => ({ a, segments: priceSegments(a) }));
  const all = segmented.flatMap((x) => x.segments);
  const isEntered = (seg) => Number.isFinite(seg.entered);
  const enteredSum = all.filter(isEntered).reduce((s, seg) => s + seg.entered, 0);
  const calculatedDays = all.filter((seg) => !isEntered(seg)).reduce((s, seg) => s + seg.days, 0);
  const left = Math.max(0, (Number.isFinite(vacationDays) ? vacationDays : 0) - enteredSum);
  const result = segmented.map(({ a, segments }) => {
    const working = Number.isFinite(a.workingRate) ? a.workingRate : 0;
    for (const seg of segments) {
      seg.calculatedVacation = calculatedDays > 0 ? left * seg.days / calculatedDays : 0;
      seg.vacationDays = isEntered(seg) ? seg.entered : seg.calculatedVacation;
      seg.hours = Math.round(Math.max(0, seg.days - seg.vacationDays) * 8 * working * 0.01);
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
    return { id: a.id, computedHours, hours, computedAmount, amount, segments, vacationDays: segments.reduce((s, seg) => s + seg.vacationDays, 0) };
  });
  return {
    assignments: result,
    totalHours: result.reduce((s, r) => s + r.hours, 0),
    total: result.reduce((s, r) => s + r.amount, 0),
    vacationDays: result.reduce((s, r) => s + r.vacationDays, 0),
  };
}

// Several people: each person's vacation applies to the assignments that person works on.
// Results keep the order of `assignments`; vacationByPerson has everyone who works on an
// assignment.
export function assignmentRevenueByPerson(assignments, vacationFor = () => VACATION_DAYS) {
  const groups = new Map();
  for (const a of assignments) {
    if (!groups.has(a.person)) groups.set(a.person, []);
    groups.get(a.person).push(a);
  }
  const byId = new Map();
  const vacationByPerson = {};
  for (const [person, list] of groups) {
    const r = assignmentRevenue(list, vacationFor(person));
    for (const x of r.assignments) byId.set(x.id, x);
    vacationByPerson[person] = r.vacationDays;
  }
  const result = assignments.map((a) => byId.get(a.id));
  return {
    assignments: result,
    totalHours: result.reduce((s, r) => s + r.hours, 0),
    total: result.reduce((s, r) => s + r.amount, 0),
    vacationByPerson,
  };
}
