// Scenario documents: the one format used for remembering data between visits, export /
// import and saved scenarios. Pure functions, no DOM access.
//
// Document:
//   { app, version, savedAt, current: <state>, scenarios: [{ name, savedAt, state }] }
// State: the value of every editable field on the page, keyed by element id, plus
// `assignments` (a list, see assignments.js).
//
// Version 2 (current): assignments as a list with price changes.
// Version 1: one assignment as separate fields (hourlyRate, billingStartDate, ...);
// converted to version 2 when read.

import { LAST_YEAR } from './params.js';
import { assignmentRevenue, defaultAssignment } from './assignments.js';

export const APP_ID = 'ConsultingBudgetCalculator';
export const VERSION = 2;
const MAX_ASSIGNMENTS = 20;
const MAX_PRICE_CHANGES = 24;
const MAX_NAME = 80;
const MAX_SCENARIOS = 50;

// type: 'number' (number or null for an empty field), 'date' ('YYYY-MM-DD'), 'text', 'boolean'
export const FIELDS = [
  { id: 'year', type: 'number', default: 2026 },
  { id: 'vacationDays', type: 'number', default: 25 },
  { id: 'otherRevenue', type: 'number', default: 0 },
  { id: 'yearBorn', type: 'number', default: null },
  { id: 'otherEmployer', type: 'text', default: '' },
  { id: 'otherSalaryYear', type: 'number', default: 0 },
  { id: 'kommun', type: 'text', default: '' },
  { id: 'churchMember', type: 'boolean', default: false },
  { id: 'forsamling', type: 'text', default: '' },
  { id: 'kyrkoavgift', type: 'number', default: null }, // rate in % for the församling
  { id: 'useMaxGrossSalary', type: 'boolean', default: false },
  { id: 'grossSalaryMonth', type: 'number', default: 55000 },
  { id: 'salaryMonths', type: 'number', default: 12 },
  { id: 'useSemesterersattning', type: 'boolean', default: true },
  { id: 'usePension', type: 'boolean', default: true },
  { id: 'pensionPercent', type: 'number', default: 4.7 },
  { id: 'pensionMode', type: 'text', default: 'percent' },
  { id: 'pensionAmount', type: 'number', default: 0 },
  { id: 'otherCosts', type: 'number', default: 20000 },
  { id: 'omkostnadsbelopp', type: 'number', default: 25000 },
  { id: 'savedDividends', type: 'number', default: 0 },
  { id: 'maxDividend', type: 'boolean', default: true },
  { id: 'grossDividends', type: 'number', default: 0 },
];

export function defaultState() {
  return { ...Object.fromEntries(FIELDS.map((f) => [f.id, f.default])), assignments: [defaultAssignment()] };
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
  ['workingRate', 'number'], ['billableHours', 'number'], ['manualAmount', 'number'],
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

// Returns { state, invalid } where invalid counts values that were replaced by defaults.
// Unknown keys are dropped. Accepts both version 1 and version 2 states.
export function validateState(obj) {
  const state = defaultState();
  let invalid = 0;
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { state, invalid: 1 };
  for (const f of FIELDS) {
    if (!(f.id in obj)) continue;
    if (validValue(f.type, obj[f.id])) state[f.id] = obj[f.id];
    else invalid++;
  }
  const list = Array.isArray(obj.assignments) ? obj.assignments.slice(0, MAX_ASSIGNMENTS) : [legacyAssignment(obj)].filter(Boolean);
  if (list.length) {
    const used = new Set();
    state.assignments = list.map((a, i) => {
      let id = typeof a?.id === 'string' && /^[a-z0-9]{1,12}$/.test(a.id) && !used.has(a.id) ? a.id : null;
      for (let n = i + 1; !id; n++) if (!used.has(`a${n}`)) id = `a${n}`;
      used.add(id);
      const v = validateAssignment(a, id);
      invalid += v.invalid;
      return v.assignment;
    });
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

// True if the state is what a first-time visitor sees (nothing worth remembering).
export function isPristine(state) {
  const d = defaultState();
  for (const f of FIELDS) {
    if (state[f.id] !== d[f.id]) return false;
  }
  if (state.assignments?.length !== 1) return false;
  const a = state.assignments[0];
  const def = d.assignments[0];
  for (const key of ['id', 'name', 'hourlyRate', 'startDate', 'endDate', 'workingRate', 'manualAmount']) {
    if (a[key] !== def[key]) return false;
  }
  if (a.priceChanges.length) return false;
  return a.billableHours === null || a.billableHours === assignmentRevenue([{ ...a, billableHours: null }], state.vacationDays).totalHours;
}

// Converts a state to engine inputs. kommunRates: { year: { KOMMUN: [skattesats, begravning] } }
export function toEngineInputs(state, kommunRates) {
  const num = (v) => (v === null || v === undefined ? NaN : v);
  const rates = (kommunRates[state.year] ?? kommunRates[LAST_YEAR] ?? {})[state.kommun];
  const invoiced = assignmentRevenue(state.assignments ?? [], num(state.vacationDays)).total;
  return {
    year: num(state.year),
    yearBorn: num(state.yearBorn),
    kommunalSkattPercent: rates ? rates[0] : NaN,
    burialSkattPercent: rates ? rates[1] : NaN,
    churchMember: state.churchMember,
    churchSkattPercent: state.churchMember && state.forsamling ? num(state.kyrkoavgift) : NaN,
    useMaxGrossSalary: state.useMaxGrossSalary,
    grossSalaryMonth: num(state.grossSalaryMonth),
    salaryMonths: num(state.salaryMonths),
    useSemesterersattning: state.useSemesterersattning,
    vacationDays: num(state.vacationDays),
    usePension: state.usePension,
    pensionPercent: num(state.pensionPercent),
    otherSalaryYear: num(state.otherSalaryYear),
    pensionMode: state.pensionMode,
    pensionAmount: num(state.pensionAmount),
    otherCosts: num(state.otherCosts),
    otherRevenue: num(state.otherRevenue),
    invoicedAmount: invoiced,
    maxDividend: state.maxDividend,
    grossDividends: num(state.grossDividends),
    savedDividends: num(state.savedDividends),
    omkostnadsbelopp: num(state.omkostnadsbelopp),
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
