// Scenario documents: the one format used for remembering data between visits, export /
// import and saved scenarios. Pure functions, no DOM access.
//
// Document:
//   { app, version, savedAt, current: <state>, scenarios: [{ name, savedAt, state }] }
// State: the company-level fields (FIELDS), `people` (PERSON_FIELDS each) and
// `assignments` (see assignments.js; each has `person`, who works on it).
//
// Version 3 (current): several people in the company.
// Version 2: one person; the person's fields were at the top level of the state.
// Version 1: as version 2, and one assignment as separate fields (hourlyRate, ...).
// Older versions are converted when read.

import { LAST_YEAR } from './params.js';
import { assignmentRevenueByPerson, defaultAssignment } from './assignments.js';

export const APP_ID = 'ConsultingBudgetCalculator';
export const VERSION = 3;
const MAX_ASSIGNMENTS = 20;
const MAX_PEOPLE = 10;
const MAX_PRICE_CHANGES = 24;
const MAX_NAME = 80;
const MAX_SCENARIOS = 50;

// type: 'number' (number or null for an empty field), 'date' ('YYYY-MM-DD'), 'text', 'boolean'
export const FIELDS = [
  { id: 'year', type: 'number', default: 2026 },
  { id: 'otherRevenue', type: 'number', default: 0 },
  { id: 'otherCosts', type: 'number', default: 20000 },
  { id: 'maxDividend', type: 'boolean', default: true },
  { id: 'grossDividends', type: 'number', default: 0 }, // total for the company
];

export const PERSON_FIELDS = [
  { id: 'name', type: 'text', default: '' },
  { id: 'ownership', type: 'number', default: 100 }, // % of the shares
  { id: 'employed', type: 'boolean', default: true },
  { id: 'yearBorn', type: 'number', default: null },
  { id: 'kommun', type: 'text', default: '' },
  { id: 'churchMember', type: 'boolean', default: false },
  { id: 'forsamling', type: 'text', default: '' },
  { id: 'kyrkoavgift', type: 'number', default: null }, // rate in % for the församling
  { id: 'useMaxGrossSalary', type: 'boolean', default: false },
  { id: 'grossSalaryMonth', type: 'number', default: 55000 },
  { id: 'salaryMonths', type: 'number', default: 12 },
  { id: 'vacationDays', type: 'number', default: 25 },
  { id: 'useSemesterersattning', type: 'boolean', default: true },
  { id: 'usePension', type: 'boolean', default: true },
  { id: 'pensionPercent', type: 'number', default: 4.7 },
  { id: 'pensionMode', type: 'text', default: 'percent' },
  { id: 'pensionAmount', type: 'number', default: 0 },
  { id: 'omkostnadsbelopp', type: 'number', default: 25000 },
  { id: 'savedDividends', type: 'number', default: 0 },
  { id: 'otherEmployer', type: 'text', default: '' },
  { id: 'otherSalaryYear', type: 'number', default: 0 },
];

const ID = /^[a-z0-9]{1,12}$/;

export function defaultPerson(id = 'p1') {
  return { id, ...Object.fromEntries(PERSON_FIELDS.map((f) => [f.id, f.default])) };
}

export function defaultState() {
  return { ...Object.fromEntries(FIELDS.map((f) => [f.id, f.default])), people: [defaultPerson()], assignments: [defaultAssignment()] };
}

function validValue(type, v) {
  switch (type) {
    case 'number': return v === null || (typeof v === 'number' && Number.isFinite(v));
    case 'date': return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
    case 'text': return typeof v === 'string' && v.length <= 200;
    case 'boolean': return typeof v === 'boolean';
    default: return false;
  }
}

const ASSIGNMENT_FIELDS = [
  ['name', 'text'], ['hourlyRate', 'number'], ['startDate', 'date'], ['endDate', 'date'],
  ['workingRate', 'number'], ['billableHours', 'number'], ['manualAmount', 'number'], ['person', 'text'],
];

// Returns { assignment, invalid }.
function validateAssignment(obj, id) {
  const a = defaultAssignment(id);
  let invalid = 0;
  if (!obj || typeof obj !== 'object') return { assignment: a, invalid: 1 };
  for (const [key, type] of ASSIGNMENT_FIELDS) {
    if (!(key in obj)) continue;
    if (validValue(type, obj[key]) && !(key === 'name' && obj[key].length > 60)) a[key] = obj[key];
    else invalid++;
  }
  if (Array.isArray(obj.priceChanges)) {
    for (const c of obj.priceChanges.slice(0, MAX_PRICE_CHANGES)) {
      if (validValue('date', c?.from) && typeof c?.hourlyRate === 'number' && Number.isFinite(c.hourlyRate)) {
        a.priceChanges.push({ from: c.from, hourlyRate: c.hourlyRate });
      } else {
        invalid++;
      }
    }
  }
  return { assignment: a, invalid };
}

// Version 1 kept one assignment as separate fields.
function legacyAssignment(obj) {
  const keys = { hourlyRate: 'hourlyRate', billingStartDate: 'startDate', billingEndDate: 'endDate',
    workingRate: 'workingRate', billableHours: 'billableHours', manualInvoicedAmount: 'manualAmount' };
  if (!Object.keys(keys).some((k) => k in obj)) return null;
  return Object.fromEntries(Object.entries(keys).filter(([k]) => k in obj).map(([k, v]) => [v, obj[k]]));
}

// Unique ids: keeps a valid unused id, otherwise the first free `${prefix}N`.
function uniqueIds(list, prefix) {
  const used = new Set();
  return list.map((x, i) => {
    let id = typeof x?.id === 'string' && ID.test(x.id) && !used.has(x.id) ? x.id : null;
    for (let n = i + 1; !id; n++) if (!used.has(`${prefix}${n}`)) id = `${prefix}${n}`;
    used.add(id);
    return id;
  });
}

function validatePerson(obj, id) {
  const person = defaultPerson(id);
  let invalid = 0;
  if (!obj || typeof obj !== 'object') return { person, invalid: 1 };
  for (const f of PERSON_FIELDS) {
    if (!(f.id in obj)) continue;
    if (validValue(f.type, obj[f.id]) && !(f.id === 'name' && obj[f.id].length > 60)) person[f.id] = obj[f.id];
    else invalid++;
  }
  return { person, invalid };
}

// Returns { state, invalid } where invalid counts values that were replaced by defaults.
// Unknown keys are dropped. Accepts states from versions 1, 2 and 3.
export function validateState(obj) {
  const state = defaultState();
  let invalid = 0;
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { state, invalid: 1 };
  for (const f of FIELDS) {
    if (!(f.id in obj)) continue;
    if (validValue(f.type, obj[f.id])) state[f.id] = obj[f.id];
    else invalid++;
  }
  // Versions 1 and 2 had one person, with the fields at the top level.
  const people = Array.isArray(obj.people) && obj.people.length ? obj.people.slice(0, MAX_PEOPLE) : [{ ...obj, id: 'p1', name: '', ownership: 100, employed: true }];
  const personIds = uniqueIds(people, 'p');
  state.people = people.map((p, i) => {
    const v = validatePerson(p, personIds[i]);
    invalid += v.invalid;
    return v.person;
  });

  const list = Array.isArray(obj.assignments) ? obj.assignments.slice(0, MAX_ASSIGNMENTS) : [legacyAssignment(obj)].filter(Boolean);
  if (list.length) {
    const ids = uniqueIds(list, 'a');
    state.assignments = list.map((a, i) => {
      const v = validateAssignment(a, ids[i]);
      invalid += v.invalid;
      return v.assignment;
    });
  }
  // Everyone works on an assignment of a person who exists.
  for (const a of state.assignments) {
    if (!personIds.includes(a.person)) a.person = personIds[0];
  }
  return { state, invalid };
}

function cleanName(name, index) {
  const s = typeof name === 'string' ? name.trim().slice(0, MAX_NAME) : '';
  return s || `Scenario ${index + 1}`;
}

export function makeDocument(current, scenarios = [], now = new Date()) {
  return {
    app: APP_ID,
    version: VERSION,
    savedAt: now.toISOString(),
    current,
    scenarios: scenarios.map((s) => ({ name: s.name, savedAt: s.savedAt, state: s.state })),
  };
}

export class ScenarioFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScenarioFormatError';
  }
}

// Parses a document (object or JSON text). Throws ScenarioFormatError with a message that
// can be shown to the user. Returns { current, scenarios, invalid }.
export function parseDocument(input) {
  let doc = input;
  if (typeof input === 'string') {
    try {
      doc = JSON.parse(input);
    } catch {
      throw new ScenarioFormatError('Filen kunde inte läsas (inte giltig JSON).');
    }
  }
  if (!doc || typeof doc !== 'object' || doc.app !== APP_ID) {
    throw new ScenarioFormatError('Filen är inte en export från budgetkalkylatorn.');
  }
  if (!Number.isInteger(doc.version) || doc.version < 1) {
    throw new ScenarioFormatError('Filen har ett okänt format.');
  }
  if (doc.version > VERSION) {
    throw new ScenarioFormatError('Filen kommer från en nyare version av kalkylatorn. Ladda om sidan och försök igen.');
  }
  // Future versions: migrate older documents here, one version step at a time.
  let invalid = 0;
  const current = validateState(doc.current);
  invalid += current.invalid;
  const scenarios = (Array.isArray(doc.scenarios) ? doc.scenarios : []).slice(0, MAX_SCENARIOS).map((s, i) => {
    const v = validateState(s?.state);
    invalid += v.invalid;
    const savedAt = typeof s?.savedAt === 'string' && !isNaN(Date.parse(s.savedAt)) ? s.savedAt : null;
    return { name: cleanName(s?.name, i), savedAt, state: v.state };
  });
  return { current: current.state, scenarios, invalid };
}

// Billable hours and invoiced amount for the state's assignments (each person's vacation
// spread over the assignments that person works on).
export function revenueForState(state) {
  const num = (v) => (v === null || v === undefined ? NaN : v);
  const vacation = (id) => num((state.people.find((p) => p.id === id) ?? state.people[0])?.vacationDays);
  return assignmentRevenueByPerson(state.assignments ?? [], vacation);
}

// True if the state is what a first-time visitor sees (nothing worth remembering).
export function isPristine(state) {
  const d = defaultState();
  for (const f of FIELDS) {
    // With maximal utdelning the dividend is calculated, not entered.
    if (f.id === 'grossDividends' && state.maxDividend) continue;
    if (state[f.id] !== d[f.id]) return false;
  }
  if (state.people?.length !== 1) return false;
  for (const f of PERSON_FIELDS) {
    if (state.people[0][f.id] !== d.people[0][f.id]) return false;
  }
  if (state.people[0].id !== 'p1' || state.assignments?.length !== 1) return false;
  const a = state.assignments[0];
  const def = d.assignments[0];
  for (const key of ['id', 'name', 'hourlyRate', 'startDate', 'endDate', 'workingRate', 'manualAmount']) {
    if (a[key] !== def[key]) return false;
  }
  if (a.priceChanges.length) return false;
  return a.billableHours === null || a.billableHours === revenueForState({ ...state, assignments: [{ ...a, billableHours: null }] }).totalHours;
}

// Converts a state to calculateCompany() inputs.
// kommunRates: { year: { KOMMUN: [skattesats, begravning] } }
export function toEngineInputs(state, kommunRates) {
  const num = (v) => (v === null || v === undefined ? NaN : v);
  const yearRates = kommunRates[state.year] ?? kommunRates[LAST_YEAR] ?? {};
  return {
    year: num(state.year),
    company: {
      invoicedAmount: revenueForState(state).total,
      otherRevenue: num(state.otherRevenue),
      otherCosts: num(state.otherCosts),
      maxDividend: state.maxDividend,
      grossDividends: num(state.grossDividends),
    },
    people: state.people.map((p) => {
      const rates = yearRates[p.kommun];
      return {
        id: p.id,
        ownershipPercent: num(p.ownership),
        employed: p.employed,
        yearBorn: num(p.yearBorn),
        kommunalSkattPercent: rates ? rates[0] : NaN,
        burialSkattPercent: rates ? rates[1] : NaN,
        churchMember: p.churchMember,
        churchSkattPercent: p.churchMember && p.forsamling ? num(p.kyrkoavgift) : NaN,
        useMaxGrossSalary: p.useMaxGrossSalary,
        grossSalaryMonth: num(p.grossSalaryMonth),
        salaryMonths: num(p.salaryMonths),
        useSemesterersattning: p.useSemesterersattning,
        vacationDays: num(p.vacationDays),
        usePension: p.usePension,
        pensionPercent: num(p.pensionPercent),
        pensionMode: p.pensionMode,
        pensionAmount: num(p.pensionAmount),
        otherSalaryYear: num(p.otherSalaryYear),
        savedDividends: num(p.savedDividends),
        omkostnadsbelopp: num(p.omkostnadsbelopp),
      };
    }),
  };
}

// CSV for Swedish spreadsheet programs: semicolon separator, decimal comma, CRLF line
// endings, UTF-8 with BOM so å, ä and ö are read correctly. rows: arrays of cells
// (string | number | null).
export function toCsv(rows) {
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v).replace('.', ',') : '';
    let s = String(v);
    // Text starting with these characters could be run as a formula by the spreadsheet.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[;"\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}
