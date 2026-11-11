// Page logic: reads the form, runs the engine and writes results and charts.
// All tax maths lives in engine.js; this file only deals with the page.
import { calculateCompany, companySalarySweep } from './engine.js';
import { defaultAssignment } from './assignments.js';
import { EXPLANATIONS } from './explanations.js';
import { buildStructure, renderMap, renderFlowList } from './structure.js';
import { initQuick } from './quick.js';
import { FIRST_YEAR, LAST_YEAR, UnsupportedYearError, getYearParams } from './params.js';
import { grundavdragGroup } from './grundavdrag.js';
import {
  FIELDS, PERSON_FIELDS, defaultState, defaultPerson, makeDocument, parseDocument, isPristine, toEngineInputs, toCsv,
  revenueForState,
} from './scenario.js';
import { loadStored, saveStored, clearStored, loadPrefs, savePrefs, clearPrefs } from './storage.js';

const $ = (id) => document.getElementById(id);

// Asks a yes/no question in a dialog on the page. The browser's own confirm dialog is
// blocked without a sound in some embedded browsers, which made buttons do nothing.
function ask(message, okLabel = 'OK') {
  const dialog = $('confirmDialog');
  $('confirmMessage').textContent = message;
  $('confirmOk').textContent = okLabel;
  dialog.returnValue = '';
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
    dialog.showModal();
    $('confirmOk').focus();
  });
}

// ---------------------------------------------------------------------------
// Data loading (kommun rates and förhöjt grundavdrag tables are served by this site)
// ---------------------------------------------------------------------------

let kommunRates = {}; // { year: { KOMMUN: [skattesats, begravningsavgift] } }
const grundavdragTables = {}; // { 'year-group': rows }
const engineData = { grundavdragTable: (year, group) => grundavdragTables[`${year}-${group}`] };

async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function ensureGrundavdragTable(year, group) {
  const key = `${year}-${group}`;
  if (group !== 'forhojt' || grundavdragTables[key]) return;
  grundavdragTables[key] = (await loadJson(`data/grundavdrag/${key}.json`)).rows;
}

// ---------------------------------------------------------------------------
// Status messages
// ---------------------------------------------------------------------------

const statusMessages = new Map();
function setStatus(key, message) {
  if (message) statusMessages.set(key, message);
  else statusMessages.delete(key);
  const el = $('statusMessage');
  el.textContent = [...statusMessages.values()].join(' ');
  el.hidden = statusMessages.size === 0;
}

// ---------------------------------------------------------------------------
// Output fields: formatted text for people, raw value in data-value for export and tests
// ---------------------------------------------------------------------------

function setOutput(el, value, decimals = 0) {
  if (typeof el === 'string') el = $(el);
  const raw = Number.isFinite(value) ? value.toFixed(decimals) : '';
  el.dataset.value = raw;
  const unit = el.dataset.unit ? ` ${el.dataset.unit}` : '';
  el.textContent = raw === ''
    ? '–'
    : Number(raw).toLocaleString('sv-SE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + unit;
}

// Tax rates are shown exactly as published (e.g. 30,55 %).
function setRate(id, value) {
  const el = $(id);
  const v = value === null || value === undefined || value === '' ? '' : String(value);
  el.dataset.value = v;
  el.textContent = v === '' ? '–' : `${v.replace('.', ',')} %`;
}

// ---------------------------------------------------------------------------
// Kommun, församling and tax rates
// ---------------------------------------------------------------------------

const yearField = $('year');
const kommunSelector = $('kommunSelector');
const churchMemberField = $('churchMember');
const forsamlingSelector = $('forsamlingSelector');
const KYRKOAVGIFT_DATASET = 'https://skatteverket.entryscape.net/rowstore/dataset/c67b320b-ffee-4876-b073-dd9236cd2a99';

function ratesForYear(year) {
  return kommunRates[year] ?? kommunRates[LAST_YEAR];
}

function populateKommunDropdown() {
  const selected = kommunSelector.value;
  kommunSelector.innerHTML = '';
  const placeholder = new Option('--- VÄLJ KOMMUN---', '', true, true);
  placeholder.disabled = true;
  kommunSelector.add(placeholder);
  for (const kommun of Object.keys(ratesForYear(parseInt(yearField.value)) ?? {})) {
    kommunSelector.add(new Option(kommun, kommun, false, kommun === selected));
  }
}

function validKommun() {
  return kommunSelector.selectedIndex > 0;
}

function validForsamling() {
  return forsamlingSelector.selectedIndex > 0;
}

// preferred: { name, rate } to select (used when restoring saved data). If the live lookup
// fails, the preferred församling is still offered with its stored rate.
let forsamlingRequest = 0;
async function populateForsamling(preferred = null) {
  if (!churchMemberField.checked || !validKommun()) return;
  const request = ++forsamlingRequest; // a newer lookup (or another person) wins
  const selected = preferred?.name ?? forsamlingSelector.selectedOptions[0]?.text;
  forsamlingSelector.innerHTML = '';
  const placeholder = new Option('--- VÄLJ FÖRSAMLING---', '', true, true);
  placeholder.disabled = true;
  forsamlingSelector.add(placeholder);
  forsamlingSelector.disabled = false;
  try {
    const url = `${KYRKOAVGIFT_DATASET}?_limit=500&kommun=${encodeURIComponent(kommunSelector.value)}&%C3%A5r=${yearField.value}`;
    const data = await loadJson(url);
    if (request !== forsamlingRequest) return;
    for (const row of data.results) {
      const name = row['församling'];
      forsamlingSelector.add(new Option(name, row.kyrkoavgift, false, name === selected));
    }
    setStatus('forsamling', null);
  } catch (error) {
    if (request !== forsamlingRequest) return;
    console.error(error);
    setStatus('forsamling', 'Kunde inte hämta församlingar från Skatteverket. Försök igen senare.');
    if (preferred?.name && preferred.rate !== null) {
      forsamlingSelector.add(new Option(preferred.name, preferred.rate, false, true));
    }
  }
  updateTaxRates();
}

// Fills the (read-only) rate fields from the bundled kommun data and the chosen församling.
function showTaxRates() {
  const rates = validKommun() ? ratesForYear(parseInt(yearField.value))?.[kommunSelector.value] : null;
  setRate('kommunalSkattPercent', rates ? rates[0] : '');
  setRate('burialSkattPercent', rates ? rates[1] : '');
  setRate('churchSkattPercent', churchMemberField.checked && validForsamling() ? forsamlingSelector.value : '');
}
function updateTaxRates() {
  showTaxRates();
  updateAll();
}

kommunSelector.addEventListener('change', () => {
  populateForsamling();
  updateTaxRates();
});
forsamlingSelector.addEventListener('change', updateTaxRates);
churchMemberField.addEventListener('change', () => {
  $('forsamling').hidden = !churchMemberField.checked;
  if (churchMemberField.checked) populateForsamling();
  updateTaxRates();
});

// ---------------------------------------------------------------------------
// Uppdrag: one or more assignments, each with its own Uppdrag and Fakturerat card
// ---------------------------------------------------------------------------

let assignments = [defaultAssignment()];
let lastRevenue = revenueForState({ people: [defaultPerson()], assignments });
const assignmentParts = $('assignmentParts');
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const assignmentName = (a, i) => a.name.trim() || (assignments.length > 1 ? `Uppdrag ${i + 1}` : 'Uppdrag');

// Cards are rebuilt only when assignments or price changes are added or removed, so that
// typing in a field keeps its focus.
function renderAssignmentCards() {
  const selected = prefs.part;
  assignmentParts.innerHTML = assignments.map((a, i) => {
    const id = a.id;
    const field = (name, label, type, value, extra = '') =>
      `<div class="row"><label for="${name}-${id}">${label}</label><input type="${type}" id="${name}-${id}" data-a="${id}" data-field="${name}" data-explain="${name === 'name' ? 'assignmentName' : name}" value="${esc(value)}" ${extra}></div>`;
    const prices = a.priceChanges.map((c, k) => `
      <div class="row price-change"><label for="pcFrom-${id}-${k}">Nytt pris från</label>
        <span class="inline"><input type="date" id="pcFrom-${id}-${k}" data-a="${id}" data-pc="${k}" data-field="from" value="${esc(c.from)}">
        <input type="number" id="pcRate-${id}-${k}" data-a="${id}" data-pc="${k}" data-field="hourlyRate" value="${esc(c.hourlyRate)}" step="10" min="0" inputmode="numeric" aria-label="Nytt timpris">
        <button type="button" class="icon-button" data-action="removePrice" data-a="${id}" data-pc="${k}" aria-label="Ta bort prisändringen">✕</button></span></div>`).join('');
    return `
      <section class="card part" data-part="uppdrag-${id}" aria-labelledby="h-uppdrag-${id}">
        <h2 id="h-uppdrag-${id}"><span data-a-title="${id}">${esc(assignmentName(a, i))}</span> <span class="badge source">Uppdrag</span></h2>
        <p class="kind">Räknare: Fakturerat belopp</p>
        ${field('name', 'Kund eller namn', 'text', a.name, 'maxlength="60" placeholder="t.ex. Kund A"')}
        ${people.length > 1 ? `<div class="row"><label for="worker-${id}">Vem arbetar</label><select id="worker-${id}" data-a="${id}" data-field="person" data-explain="assignmentPerson">${people.map((p, k) => `<option value="${p.id}" data-person-option="${p.id}" ${p.id === a.person ? 'selected' : ''}>${esc(personName(p, k))}</option>`).join('')}</select></div>` : ''}
        ${field('hourlyRate', 'Timpris exkl. moms', 'number', a.hourlyRate, 'step="10" min="0" inputmode="numeric"')}
        ${field('startDate', 'Uppdrag start', 'date', a.startDate)}
        ${field('endDate', 'Uppdrag slut', 'date', a.endDate)}
        ${prices}
        <div class="row-actions"><button type="button" class="link-button" data-action="addPrice" data-a="${id}">+ Prisändring under uppdraget</button></div>
        <details class="details">
          <summary>Detaljer</summary>
          ${field('workingRate', 'Arbetstakt (%)', 'number', a.workingRate, 'step="25" min="0" max="100" inputmode="numeric"')}
          ${field('billableHours', 'Fakturerbara timmar', 'number', a.billableHours ?? '', 'min="0" inputmode="numeric"')}
        </details>
        <div class="result"><label for="invoiced-${id}">→ Fakturerat belopp exkl. moms</label><output id="invoiced-${id}" data-unit="kr" data-explain="invoicedAmount"></output>
          <small>går till <button type="button" class="link-button" data-goto="faktura-${id}">Fakturerat</button> och vidare till bolaget</small></div>
        ${assignments.length > 1 ? `<div class="row-actions"><button type="button" class="link-button" data-action="removeAssignment" data-a="${id}">Ta bort uppdraget</button></div>` : ''}
      </section>
      <section class="card part" data-part="faktura-${id}" aria-labelledby="h-faktura-${id}">
        <h2 id="h-faktura-${id}">Fakturerat: <span data-a-title="${id}">${esc(assignmentName(a, i))}</span> → bolaget <span class="badge edge">Intäkt</span></h2>
        <p class="kind">Räknare: Fakturerat belopp till bolaget</p>
        <div class="row"><label for="fromAssignment-${id}">Räknat i uppdraget <button type="button" class="from ${a.manualAmount !== null ? 'manual' : ''}" data-goto="uppdrag-${id}">från Uppdrag</button></label><output id="fromAssignment-${id}" data-unit="kr" data-explain="fromAssignment"></output></div>
        <div class="row" ${a.manualAmount === null ? 'hidden' : ''}><label for="manualAmount-${id}">Eget belopp</label><input type="number" id="manualAmount-${id}" data-a="${id}" data-field="manualAmount" data-explain="manualInvoicedAmount" value="${esc(a.manualAmount ?? '')}" step="10000" min="0" inputmode="numeric"></div>
        <div class="row-actions"><button type="button" class="link-button" data-action="toggleManual" data-a="${id}">${a.manualAmount === null ? 'Ange eget belopp i stället' : 'Använd beloppet från uppdraget igen'}</button></div>
        <div class="result"><label for="used-${id}">→ Fakturerat till bolaget</label><output id="used-${id}" data-unit="kr" data-explain="usedInvoicedAmount"></output>
          <small>går till <button type="button" class="link-button" data-goto="bolag">ditt aktiebolag</button></small></div>
      </section>`;
  }).join('');
  addInfoButtons(assignmentParts);
  for (const el of assignmentParts.querySelectorAll('.part')) el.classList.toggle('active', el.dataset.part === selected);
  updateAssignmentOutputs();
}

function updateAssignmentOutputs() {
  syncFormToPerson();
  lastRevenue = revenueForState({ people, assignments });
  lastRevenue.assignments.forEach((r, i) => {
    const id = r.id;
    if (!$(`invoiced-${id}`)) return;
    setOutput(`invoiced-${id}`, r.computedAmount);
    setOutput(`fromAssignment-${id}`, r.computedAmount);
    setOutput(`used-${id}`, r.amount);
    $(`billableHours-${id}`).placeholder = `${r.computedHours} (beräknat)`;
    for (const t of document.querySelectorAll(`[data-a-title="${id}"]`)) t.textContent = assignmentName(assignments[i], i);
  });
}

function nextAssignmentId() {
  for (let n = 1; ; n++) if (!assignments.some((a) => a.id === `a${n}`)) return `a${n}`;
}

function addAssignment() {
  const year = Number(yearField.value) || 2026;
  const a = { ...defaultAssignment(nextAssignmentId(), year, selectedPersonId), name: '' };
  assignments.push(a);
  renderAssignmentCards();
  selectPart(`uppdrag-${a.id}`, { scroll: true });
  $(`name-${a.id}`).focus();
  updateAll();
}
$('addAssignment').addEventListener('click', addAssignment);

const findAssignment = (id) => assignments.find((a) => a.id === id);

assignmentParts.addEventListener('input', (e) => {
  const el = e.target;
  const a = findAssignment(el.dataset.a);
  if (!a || !el.dataset.field) return;
  const num = (v) => (v === '' || isNaN(Number(v)) ? null : Number(v));
  if (el.dataset.pc !== undefined) {
    const c = a.priceChanges[Number(el.dataset.pc)];
    c[el.dataset.field] = el.dataset.field === 'from' ? el.value : num(el.value);
  } else if (['name', 'startDate', 'endDate', 'person'].includes(el.dataset.field)) {
    a[el.dataset.field] = el.value;
  } else {
    a[el.dataset.field] = num(el.value);
  }
  updateAll();
});

assignmentParts.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const a = findAssignment(b.dataset.a);
  if (!a) return;
  const action = b.dataset.action;
  if (action === 'addPrice') {
    const last = a.priceChanges.at(-1);
    const year = (a.startDate || yearField.value || '2026').slice(0, 4);
    a.priceChanges.push({ from: last ? last.from : `${year}-04-01`, hourlyRate: (last?.hourlyRate ?? a.hourlyRate ?? 0) + 50 });
  } else if (action === 'removePrice') {
    a.priceChanges.splice(Number(b.dataset.pc), 1);
  } else if (action === 'toggleManual') {
    const r = lastRevenue.assignments.find((x) => x.id === a.id);
    a.manualAmount = a.manualAmount === null ? Math.round(r?.computedAmount ?? 0) : null;
  } else if (action === 'removeAssignment') {
    if (assignments.length < 2 || !(await ask(`Ta bort ${assignmentName(a, assignments.indexOf(a)).toLowerCase() === 'uppdrag' ? 'uppdraget' : `"${assignmentName(a, assignments.indexOf(a))}"`}?`, 'Ta bort'))) return;
    assignments = assignments.filter((x) => x !== a);
    prefs.part = `uppdrag-${assignments[0].id}`;
  }
  renderAssignmentCards();
  if (action === 'toggleManual' && a.manualAmount !== null) {
    $(`manualAmount-${a.id}`).focus();
    $(`manualAmount-${a.id}`).select();
  }
  if (action === 'removeAssignment') selectPart(prefs.part);
  updateAll();
});

// ---------------------------------------------------------------------------
// People: the Du, Lön, Pension, Utdelning and Annan anställning cards show the selected
// person. Every person's values are kept in `people`; the form holds the selected one.
// ---------------------------------------------------------------------------

let people = [defaultPerson()];
let selectedPersonId = 'p1';
const PERSON_INPUT_IDS = { name: 'personName' }; // person field -> element id when they differ
const personEl = (key) => $(PERSON_INPUT_IDS[key] ?? key);
const selectedPerson = () => people.find((p) => p.id === selectedPersonId) ?? people[0];
const selectedIndex = () => Math.max(0, people.findIndex((p) => p.id === selectedPersonId));
function personName(p, i) {
  return p.name.trim() || (i === 0 ? 'Du' : `Person ${i + 1}`);
}
const owners = () => people.filter((p) => p.ownership > 0);

// Copies the form into the selected person.
function syncFormToPerson() {
  const p = selectedPerson();
  if (!p) return;
  for (const f of PERSON_FIELDS) {
    if (['kommun', 'forsamling', 'kyrkoavgift'].includes(f.id)) continue;
    const el = personEl(f.id);
    if (f.type === 'boolean') p[f.id] = el.checked;
    else if (f.type === 'number') p[f.id] = el.value === '' || isNaN(Number(el.value)) ? null : Number(el.value);
    else p[f.id] = el.value;
  }
  p.kommun = validKommun() ? kommunSelector.value : '';
  const forsamling = churchMemberField.checked && validForsamling();
  p.forsamling = forsamling ? forsamlingSelector.selectedOptions[0].text : '';
  p.kyrkoavgift = forsamling ? parseFloat(forsamlingSelector.value) : null;
}

// Fills the form with a person. The stored församling is offered at once and the full
// list is looked up in the background. Returns the lookup (a promise) or null.
function writePersonToForm(p) {
  for (const f of PERSON_FIELDS) {
    if (['kommun', 'forsamling', 'kyrkoavgift'].includes(f.id)) continue;
    const el = personEl(f.id);
    if (f.type === 'boolean') el.checked = p[f.id];
    else el.value = p[f.id] ?? '';
  }
  kommunSelector.value = p.kommun;
  if (kommunSelector.selectedIndex < 0) kommunSelector.selectedIndex = 0;
  $('grossSalaryMonth').disabled = p.useMaxGrossSalary;
  $('forsamling').hidden = !p.churchMember;
  forsamlingRequest++;
  forsamlingSelector.innerHTML = '';
  const placeholder = new Option('--- VÄLJ FÖRSAMLING---', '', true, !p.forsamling);
  placeholder.disabled = true;
  forsamlingSelector.add(placeholder);
  if (p.forsamling && p.kyrkoavgift !== null) forsamlingSelector.add(new Option(p.forsamling, p.kyrkoavgift, true, true));
  forsamlingSelector.disabled = !p.churchMember;
  syncPensionInputs();
  syncOther();
  syncPersonCards();
  showTaxRates();
  return p.churchMember && validKommun() ? populateForsamling({ name: p.forsamling, rate: p.kyrkoavgift }) : null;
}

function switchPerson(id) {
  if (id === selectedPersonId || !people.some((p) => p.id === id)) return;
  syncFormToPerson();
  selectedPersonId = id;
  writePersonToForm(selectedPerson());
}

// Names in headings and lists, the cards a person has (Lön and Pension if employed,
// Utdelning if owner), and labels that differ when there are several people.
function syncPersonCards() {
  const i = selectedIndex();
  const p = selectedPerson();
  const name = personName({ ...p, name: $('personName').value }, i);
  const isDu = name === 'Du';
  for (const el of document.querySelectorAll('[data-person]')) {
    el.textContent = el.dataset.person === 'title' ? name : el.dataset.person === 'object' ? (isDu ? 'dig' : name) : (isDu ? 'du' : name);
  }
  people.forEach((x, k) => {
    for (const o of document.querySelectorAll(`[data-person-option="${x.id}"]`)) o.textContent = personName(x.id === p.id ? { ...x, name: $('personName').value } : x, k);
  });
  $('personName').placeholder = i === 0 ? 'Du' : `Person ${i + 1}`;
  const several = people.length > 1;
  for (const el of document.querySelectorAll('[data-many]')) {
    el.dataset.one ??= el.textContent;
    el.textContent = several ? el.dataset.many : el.dataset.one;
  }
  document.querySelector('.part[data-part="lon"]').hidden = !$('employed').checked;
  document.querySelector('.part[data-part="pension"]').hidden = !$('employed').checked;
  document.querySelector('.part[data-part="utdelning"]').hidden = !(Number($('ownership').value) > 0);
  $('removePersonRow').hidden = !several;
  $('ownershipBadge').textContent = `Ägande ${(Number($('ownership').value) || 0).toLocaleString('sv-SE')} %`;
}

// Ägare on the company card: everyone's share in one place, the total and other owners.
function renderOwners(co) {
  const show = people.length > 1 || co?.otherOwnersShare > 0;
  $('ownersTable').hidden = !show;
  if (!show) return;
  const box = $('ownerInputs');
  const ids = people.map((p) => p.id).join(',');
  if (box.dataset.ids !== ids) {
    box.dataset.ids = ids;
    box.innerHTML = people.map((p) => `<div class="row"><span class="owner-name"><button type="button" class="link-button" data-goto="person-${p.id}" data-owner-name="${p.id}"></button></span>
      <input type="number" data-owner="${p.id}" min="0" max="100" step="any" inputmode="decimal"></div>`).join('');
  }
  people.forEach((p, i) => {
    const name = personName(p.id === selectedPersonId ? { ...p, name: $('personName').value } : p, i);
    box.querySelector(`[data-owner-name="${p.id}"]`).textContent = name;
    const input = box.querySelector(`[data-owner="${p.id}"]`);
    input.setAttribute('aria-label', `Ägarandel för ${name} (%)`);
    const value = p.id === selectedPersonId ? $('ownership').value : (p.ownership ?? '');
    if (input !== document.activeElement && input.value !== String(value)) input.value = value;
  });
  setOutput('ownershipTotal', 100 * co?.ownershipSum, 2);
  $('otherOwnersRows').hidden = !(co?.otherOwnersShare > 0);
  setOutput('otherOwnersShare', 100 * co?.otherOwnersShare, 2);
  setOutput('otherOwnersDividends', co?.otherOwnersDividends, 0);
}
$('ownerInputs').addEventListener('input', (e) => {
  const id = e.target.dataset.owner;
  if (!id) return;
  const value = e.target.value === '' || isNaN(Number(e.target.value)) ? null : Number(e.target.value);
  if (id === selectedPersonId) $('ownership').value = e.target.value;
  else people.find((p) => p.id === id).ownership = value;
  updateAll();
});

function nextPersonId() {
  for (let n = 1; ; n++) if (!people.some((p) => p.id === `p${n}`)) return `p${n}`;
}

function addPerson() {
  syncFormToPerson();
  const p = { ...defaultPerson(nextPersonId()), ownership: 0, kommun: people[0].kommun };
  people.push(p);
  if (prefs.mode !== 'structure') setMode('structure');
  renderAssignmentCards();
  selectPart(`person-${p.id}`, { scroll: true });
  $('personName').focus();
  updateAll();
}
$('addPerson').addEventListener('click', addPerson);

$('removePerson').addEventListener('click', async () => {
  const i = selectedIndex();
  const p = selectedPerson();
  if (people.length < 2 || !(await ask(`Ta bort ${personName({ ...p, name: $('personName').value }, i)}?`, 'Ta bort'))) return;
  people = people.filter((x) => x !== p);
  for (const a of assignments) if (a.person === p.id) a.person = people[0].id;
  selectedPersonId = people[0].id;
  writePersonToForm(people[0]);
  renderAssignmentCards();
  selectPart(`person-${people[0].id}`, { scroll: true });
  updateAll();
});

$('personName').addEventListener('input', updateAll);
$('ownership').addEventListener('input', updateAll);
$('employed').addEventListener('change', () => {
  syncPersonCards();
  selectPart(prefs.part);
  updateAll();
});

// ---------------------------------------------------------------------------
// Main update
// ---------------------------------------------------------------------------

// Everything the user has entered (see FIELDS and PERSON_FIELDS in scenario.js).
function readState() {
  syncFormToPerson();
  const state = {};
  for (const f of FIELDS) {
    const el = $(f.id);
    if (f.type === 'boolean') state[f.id] = el.checked;
    else if (f.type === 'number') state[f.id] = el.value === '' || isNaN(Number(el.value)) ? null : Number(el.value);
    else state[f.id] = el.value;
  }
  state.people = structuredClone(people);
  state.assignments = structuredClone(assignments);
  return state;
}

// The result as one flat object for person i: that person's fields, plus the company's
// figures under the names the company outputs use. `co` holds all company totals.
function viewFor(result, i) {
  if (!result) return null;
  const co = result.company;
  return {
    ...result.people[i],
    invoicedAmount: co.invoicedAmount, otherRevenue: co.otherRevenue, otherCosts: co.otherCosts,
    profitBeforeTax: co.profitBeforeTax, profitAfterTax: co.profitAfterTax, profitAfterDividends: co.profitAfterDividends,
    totalCost: co.totalCost, totalTax: co.totalTax, totalTaxPercentage: co.totalTaxPercentage,
    bolagsTaxExclDividends: co.bolagsTaxExclDividends,
    co,
  };
}

// Calculates a state; loads the förhöjt grundavdrag tables it needs first.
async function calculateState(state) {
  const inputs = toEngineInputs(state, kommunRates);
  const p = getYearParams(inputs.year);
  for (const person of inputs.people) {
    const age = inputs.year - person.yearBorn - 1;
    if (!isNaN(age)) await ensureGrundavdragTable(inputs.year, grundavdragGroup(age, p.forhojtGrundavdragAge));
  }
  return { inputs, result: calculateCompany(inputs, engineData) };
}

// Output field id -> decimals. Ids in COMPANY_OUTPUTS show the company's totals.
const OUTPUTS = {
  pensionDeductible: 0, pensionNonDeductible: 0, personIncomeTax: 0, otherIncomeTax: 0, otherNetYear: 0,
  grossSemesterersattning: 0, grossSalaryYear: 0, grundavdrag: 0, kommunalSkatt: 0, statligSkatt: 0,
  burialSkatt: 0, publicServiceSkatt: 0, jobbskatteavdrag: 0, skattereduktionForvarvsinkomst: 0,
  incomeTax: 0, netSalaryYear: 0, netSemesterersattning: 0, netSalaryMonth: 0, incomeTaxPercentage: 1,
  pension: 0, insurance: 0, slp: 0, arbetsgivaravgift: 0, totalCost: 0, profitBeforeTax: 0,
  profitAfterTax: 0, omkostnadsbeloppInterest: 0, salaryBasedLimit: 0, grundbelopp: 0,
  dividendsLimitForenklingsregeln: 0, dividendsLimitHuvudregeln: 0, dividendsLimit: 0,
  netDividends: 0, profitAfterDividends: 0, netSumMonth: 0, totalTax: 0, bolagsTaxExclDividends: 0,
  totalTaxPercentage: 1,
};
const COMPANY_OUTPUTS = new Set(['insurance', 'slp', 'arbetsgivaravgift']);

const format = (value, decimals) => (Number.isFinite(value) ? value.toFixed(decimals) : '');

function writeFields(r) {
  const co = r?.co;
  for (const [id, decimals] of Object.entries(OUTPUTS)) setOutput(id, COMPANY_OUTPUTS.has(id) ? co?.[id] : r?.[id], decimals);
  for (const el of document.querySelectorAll('output[data-mirror]')) {
    const key = el.dataset.mirror;
    setOutput(el, key.startsWith('co.') ? co?.[key.slice(3)] : r?.[key], 0);
  }
  $('pensionCapWarning').hidden = !(r?.pensionNonDeductible > 0);
  syncOther();
  syncPersonCards();
  setOutput('churchSkatt', churchMemberField.checked ? r?.churchSkatt : NaN);
  $('grossDividends').value = format(co?.grossDividends, 0);
  if ($('useMaxGrossSalary').checked) $('grossSalaryMonth').value = format(r?.grossSalaryMonth, 0);
  $('grossDividends').max = format(co?.dividendCap, 0);

  // Several owners: this owner's share, the company's cap and who sets it.
  const severalOwners = owners().length > 1;
  $('ownersRows').hidden = !severalOwners;
  setOutput('ownerShare', 100 * r?.ownership, 1);
  setOutput('dividendCap', co?.dividendCap, 0);
  const limiting = people.findIndex((p) => p.id === co?.limitingOwner);
  const limitingName = limiting < 0 ? '' : personName(people[limiting], limiting);
  $('limitingNote').textContent = limiting < 0 ? '' : `${limitingName === 'Du' ? 'Ditt gränsbelopp' : `Gränsbeloppet för ${limitingName}`} begränsar bolagets utdelning: den får inte bli större än att varje ägare håller sig inom sitt gränsbelopp.`;
  const sum = co?.ownershipSum;
  const pct = (v) => `${(100 * v).toLocaleString('sv-SE', { maximumFractionDigits: 2 })} %`;
  const warning = !Number.isFinite(sum) ? ''
    : sum > 1 + 1e-9 ? `Ägarandelarna är tillsammans ${pct(sum)}. De får inte bli mer än 100 % för att utdelningen ska kunna räknas.`
      : sum < 1e-9 ? 'Ingen i kalkylen äger aktier i bolaget, så ingen utdelning räknas. Ange ägarandelar under Ägare.'
        : '';
  for (const el of document.querySelectorAll('.ownership-warning')) {
    el.hidden = !warning;
    el.textContent = warning;
  }
  renderOwners(co);

  const kr = (v) => (Number.isFinite(v) ? `${Math.round(v).toLocaleString('sv-SE')} kr` : '–');
  $('sumNetName').textContent = people.length > 1 ? ` (${personName(selectedPerson(), selectedIndex())})` : '';
  $('sumNetMonth').textContent = kr(r?.netSumMonth);
  $('sumTaxPct').textContent = Number.isFinite(r?.totalTaxPercentage) ? `${r.totalTaxPercentage.toLocaleString('sv-SE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %` : '–';
  $('sumLeft').textContent = kr(r?.profitAfterDividends);
  $('sumInvoiced').textContent = kr(co?.invoicedAmount);
  // Point to the first person whose birth year or kommun is missing.
  const missing = people.findIndex((p) => p.yearBorn === null || !p.kommun);
  $('summaryHint').hidden = Number.isFinite(r?.netSumMonth) || missing < 0;
  if (missing >= 0) {
    $('summaryHintLink').dataset.goto = `person-${people[missing].id}`;
    $('summaryHintLink').textContent = personName(people[missing], missing);
  }
}

function updateYearDependentFields() {
  const year = parseInt(yearField.value);
  $('dividendLimitsContainer').hidden = year >= 2026;
  $('grundbeloppContainer').hidden = year < 2026;
}

let updateCounter = 0;
async function updateAll() {
  const id = ++updateCounter;
  updateAssignmentOutputs();
  let calc = null;
  try {
    calc = await calculateState(readState());
    if (id !== updateCounter) return; // a newer update has started
    setStatus('calculation', null);
  } catch (error) {
    if (id !== updateCounter) return;
    calc = null;
    if (!(error instanceof UnsupportedYearError)) console.error(error);
    setStatus('calculation', error instanceof UnsupportedYearError
      ? error.message
      : 'Något gick fel i beräkningen. Ladda om sidan och försök igen.');
  }
  currentResult = calc?.result ?? null;
  const view = viewFor(currentResult, selectedIndex());
  writeFields(view);
  updateCharts(calc?.inputs, view);
  updateSankeyChartData(sankeyData(currentResult));
  renderStructure();
  renderScenarios();
  scheduleSave();
}

for (const id of ['vacationDays', 'yearBorn', 'grossSalaryMonth', 'salaryMonths', 'otherRevenue', 'otherCosts',
  'grossDividends', 'savedDividends', 'omkostnadsbelopp']) {
  $(id).addEventListener('input', updateAll);
}
// Pension: % of salary or a fixed amount; the inputs follow the on/off setting.
function syncPensionInputs() {
  const on = $('usePension').checked;
  const amount = $('pensionMode').value === 'amount';
  $('pensionMode').disabled = !on;
  $('pensionPercent').disabled = !on;
  $('pensionAmount').disabled = !on;
  $('pensionPercentRow').hidden = amount;
  $('pensionAmountRow').hidden = !amount;
}
$('usePension').addEventListener('change', syncPensionInputs);
$('pensionMode').addEventListener('change', () => { syncPensionInputs(); updateAll(); });
$('pensionPercent').addEventListener('input', updateAll);
$('pensionAmount').addEventListener('input', updateAll);

// Other employment: shown when it has a name or a salary.
const otherActive = () => $('otherEmployer').value.trim() !== '' || Number($('otherSalaryYear').value) > 0;
const personOtherEmployer = (p) => (p.otherEmployer.trim() || (p.otherSalaryYear > 0 ? 'Annan anställning' : null));
function syncOther() {
  const active = otherActive();
  $('annanCard').hidden = !active;
  for (const id of ['otherIncomeRow', 'otherTaxRow', 'otherNetRow']) $(id).hidden = !active;
  $('addOther').parentElement.hidden = active;
}
$('otherEmployer').addEventListener('input', updateAll);
$('otherSalaryYear').addEventListener('input', updateAll);
$('addOther').addEventListener('click', () => {
  if (!otherActive()) $('otherEmployer').value = 'Annan arbetsgivare';
  syncOther();
  selectPart('annan', { scroll: true });
  $('otherSalaryYear').focus();
  $('otherSalaryYear').select();
  updateAll();
});
$('removeOther').addEventListener('click', () => {
  $('otherEmployer').value = '';
  $('otherSalaryYear').value = 0;
  syncOther();
  selectPart('person', { scroll: true });
  updateAll();
});
for (const id of ['useSemesterersattning', 'usePension']) {
  $(id).addEventListener('change', updateAll);
}
$('useMaxGrossSalary').addEventListener('change', function () {
  $('grossSalaryMonth').disabled = this.checked;
  updateAll();
});
$('maxDividend').addEventListener('change', function () {
  $('grossDividends').disabled = this.checked;
  updateAll();
});
yearField.addEventListener('input', () => {
  updateYearDependentFields();
  populateKommunDropdown();
  populateForsamling();
  updateTaxRates();
});

// ---------------------------------------------------------------------------
// Sankey diagram (amCharts)
// ---------------------------------------------------------------------------

const root = am5.Root.new('sankeyDiagram');
root.setThemes([am5themes_Animated.new(root)]);
const series = root.container.children.push(
  am5flow.Sankey.new(root, {
    sourceIdField: 'from',
    targetIdField: 'to',
    valueField: 'value',
    paddingTop: 20,
    paddingBottom: 20,
    linkSort: null,
    nodePadding: 40,
    tooltip: am5.Tooltip.new(root, { labelText: '[bold]{label}:[/]\n{value}' }),
  }),
);
series.nodes.get('colors').set('step', 2);
series.nodes.nodes.template.setAll({ draggable: false, toggleKey: 'none' });

// The Sankey shows the whole company: all salaries, pensions and dividends together.
function sankeyData(result) {
  if (!result) return {};
  const co = result.company;
  return { ...co, totalTax: co.totalTax, bolagsTaxExclDividends: co.bolagsTaxExclDividends };
}

function updateSankeyChartData(f) {
  const n = (label, value) => `[bold]${label}:[/]\n${Math.round(value).toLocaleString()}`;
  const loss = Math.max(0, Math.round(-f.profitBeforeTax));
  const savings2dividends = Math.max(0, Math.round(f.grossDividends - Math.max(0, f.profitAfterTax)));
  const totalTaxStr = n('Total skatt', f.totalTax + f.bolagsTaxExclDividends);
  const invoicedAmountStr = n('Fakturerat belopp', f.invoicedAmount);
  const otherRevenueStr = n('Övriga intäkter', f.otherRevenue);
  const savingsStr = n('Från besparingar', loss + savings2dividends);
  const revenueStr = n('Intäkter', f.invoicedAmount + f.otherRevenue);
  const otherCostsStr = n('Övriga kostnader', f.otherCosts);
  const grossSalaryYearStr = n('Lön brutto', f.grossSalaryYear);
  const pensionStr = n('Pension', f.pension);
  const insuranceStr = n('Försäkring', f.insurance);
  const profitBeforeTaxStr = n('Vinst brutto', f.profitBeforeTax);
  const profitAfterTaxStr = n('Vinst netto', f.profitAfterTax);
  const grossDividendsStr = n('Utdelning brutto', f.grossDividends);
  const profitAfterDividendsStr = n('Vinst efter utdelning', f.profitAfterDividends);
  const netSalaryYearStr = n('Lön netto', f.netSalaryYear);
  const netDividendsStr = n('Utdelning netto', f.netDividends);

  const isProfitable = Math.sign(f.profitAfterTax);
  const links = [
    { from: otherRevenueStr, to: revenueStr, value: Math.round(f.otherRevenue), label: 'Övriga intäkter' },
    // One inflow per assignment when there are several.
    ...(lastRevenue.assignments.length > 1
      ? lastRevenue.assignments.map((r, i) => ({
        from: n(`Fakturerat ${assignmentName(assignments[i] ?? { name: '' }, i)}`, r.amount),
        to: revenueStr, value: Math.round(r.amount), label: `Fakturerat ${assignmentName(assignments[i] ?? { name: '' }, i)}`,
      }))
      : [{ from: invoicedAmountStr, to: revenueStr, value: Math.round(f.invoicedAmount), label: 'Fakturerat belopp' }]),
    { from: savingsStr, to: revenueStr, value: loss, label: 'Förlust' },
    { from: revenueStr, to: otherCostsStr, value: Math.round(f.otherCosts), label: 'Övriga kostnader' },
    { from: revenueStr, to: insuranceStr, value: Math.round(f.insurance), label: 'Försäkring' },
    { from: revenueStr, to: pensionStr, value: Math.round(f.pension), label: 'Pension' },
    { from: revenueStr, to: grossSalaryYearStr, value: Math.round(f.grossSalaryYear), label: 'Lön brutto' },
    { from: grossSalaryYearStr, to: netSalaryYearStr, value: Math.round(f.netSalaryYear), label: 'Lön netto' },
    { from: grossSalaryYearStr, to: totalTaxStr, value: Math.round(f.incomeTax), label: 'Inkomstskatt' },
    { from: revenueStr, to: totalTaxStr, value: Math.round(f.slp), label: 'SLP' },
    { from: revenueStr, to: totalTaxStr, value: Math.round(f.arbetsgivaravgift), label: 'Arbetsgivaravgift' },
    { from: revenueStr, to: profitBeforeTaxStr, value: Math.round(f.profitBeforeTax), label: 'Vinst brutto' },
    { from: profitBeforeTaxStr, to: totalTaxStr, value: Math.round(f.bolagsTax), label: 'Bolagsskatt' },
    { from: profitBeforeTaxStr, to: profitAfterTaxStr, value: Math.round(f.profitAfterTax), label: 'Vinst netto' },
    { from: savingsStr, to: grossDividendsStr, value: -isProfitable * Math.round(f.grossDividends), label: 'Utdelning brutto' },
    { from: profitAfterTaxStr, to: grossDividendsStr, value: isProfitable * Math.round(f.grossDividends - savings2dividends), label: 'Utdelning brutto från vinst' },
    { from: savingsStr, to: grossDividendsStr, value: isProfitable * savings2dividends, label: 'Utdelning brutto från besparingar' },
    { from: grossDividendsStr, to: totalTaxStr, value: Math.round(f.dividendTax), label: 'Utdelningsskatt' },
    { from: grossDividendsStr, to: netDividendsStr, value: Math.round(f.netDividends), label: 'Utdelning netto' },
    { from: grossDividendsStr, to: n('Övriga ägare', f.otherOwnersDividends), value: Math.round(f.otherOwnersDividends || 0), label: 'Utdelning till övriga ägare' },
    { from: profitAfterTaxStr, to: profitAfterDividendsStr, value: Math.round(f.profitAfterDividends), label: 'Vinst efter utdelning' },
  ];
  if (links.some((l) => isNaN(l.value))) {
    series.data.setAll([]);
    return;
  }
  series.data.setAll(links.filter((l) => l.value > 0));
}

function updateSankeyChartSize() {
  const width = $('sankeyDiagram').offsetWidth;
  const fontSize = Math.round(width / 70);
  const labels = { fontSize, crisp: true, maxWidth: width / 9, oversizedBehavior: 'wrap', y: am5.percent(50), centerY: am5.percent(50) };
  if (width <= 400) {
    // Labels inside the nodes.
    series.nodes.labels.template.setAll({ ...labels, x: am5.percent(50), centerX: am5.percent(50), rotation: -90 });
    series.setAll({ nodeWidth: 20, paddingRight: 0, paddingLeft: 0 });
  } else {
    // Labels to the right of the nodes.
    series.nodes.labels.template.setAll({ ...labels, x: am5.percent(0), centerX: am5.percent(0), rotation: 0 });
    series.setAll({ nodeWidth: 10, paddingRight: 8 * fontSize, paddingLeft: 10 });
  }
}
window.addEventListener('resize', updateSankeyChartSize);
updateSankeyChartSize();

// ---------------------------------------------------------------------------
// Line charts (Chart.js)
// ---------------------------------------------------------------------------

// Fix for Chart.js 4 compatibility: ensure chart.crosshair exists before afterDraw.
const crosshair = Chart.registry.plugins.get('crosshair');
if (crosshair) {
  const originalAfterDraw = crosshair.afterDraw;
  crosshair.afterDraw = function (chart, args, options) {
    if (chart && chart.crosshair) originalAfterDraw.call(this, chart, args, options);
  };
}

const COLORS = {
  red: [255, 99, 132], orange: [255, 159, 64], yellow: [255, 205, 86], green: [75, 192, 192],
  blue: [54, 162, 235], purple: [153, 102, 255], amber: [235, 139, 34], cyan: [0, 235, 235],
};
const rgb = (c) => `rgb(${c.join(', ')})`;
const rgba = (c, alpha) => `rgba(${c.join(', ')}, ${alpha})`;

const crosshairOptions = { line: { color: '#F66', width: 1 }, sync: { enabled: false }, zoom: { enabled: false } };
const xAxis = { ticks: { maxTicksLimit: 10 }, title: { display: true, text: 'Månadslön brutto' } };

function area(order, label, color, extra = {}) {
  return { order, label, data: [], borderColor: rgb(color), backgroundColor: rgba(color, 0.6), ...extra };
}
function star(label, color) {
  return {
    order: 0, label, type: 'scatter', data: [], pointStyle: 'star', borderWidth: 3, pointRadius: 15,
    borderColor: rgb(color), backgroundColor: rgba(color, 0.6),
  };
}

const sumChart = new Chart($('myChart').getContext('2d'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      area(1, 'Årslön netto', COLORS.red, { fill: 'origin' }),
      area(2, 'Årsutdelning netto', COLORS.blue),
      area(3, 'Tjänstepension brutto', COLORS.purple),
      area(4, 'Årets resultat efter utdelning', COLORS.green),
      area(5, 'Total skatt*', COLORS.orange),
      area(6, 'Bolagskatt på ej utdelad vinst', COLORS.amber),
      star('Högst summa (lön + utdelning) netto', COLORS.yellow),
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: { x: xAxis, y: { stacked: true } },
    elements: { line: { fill: '-1' } }, // fill each line down to the previous dataset
    plugins: { crosshair: crosshairOptions },
  },
});

const percentageChart = new Chart($('percentageChart').getContext('2d'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      { order: 1, label: 'Total skatt* / (lön brutto + utdelning brutto)', data: [], borderColor: rgb(COLORS.orange), backgroundColor: rgb(COLORS.orange) },
      { order: 2, label: 'Marginalskatt = d(Total skatt*) / d(lön brutto + utdelning brutto)', data: [], borderColor: rgb(COLORS.red), backgroundColor: rgb(COLORS.red) },
      star('Lägst Total skatt* / (lön brutto + utdelning brutto)', COLORS.cyan),
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: { x: xAxis, y: { title: { display: true, text: '%' } } },
    plugins: { crosshair: crosshairOptions },
  },
});

// The salary sweep varies the selected person's salary with everything else fixed.
function updateCharts(inputs, view) {
  const s = inputs && view && Number.isFinite(view.co?.totalTaxPercentage) ? companySalarySweep(inputs, selectedIndex(), engineData) : null;
  const name = personName(selectedPerson(), selectedIndex());
  $('h-sum').textContent = people.length > 1 ? `Lön eller utdelning för ${name === 'Du' ? 'dig' : name}?` : 'Lön eller utdelning?';
  const sum = sumChart.data;
  const pct = percentageChart.data;
  sum.labels = s ? s.grossSalaryMonth : [];
  const series = s ? [s.netSalaryYear, s.netDividends, s.pension, s.profitAfterDividends, s.totalTax, s.bolagsTaxExclDividends, [s.maxSum]] : [];
  sum.datasets.forEach((d, i) => { d.data = series[i] ?? []; });
  pct.labels = s ? s.grossSalaryMonth : [];
  const pctSeries = s ? [s.taxPercentage, s.marginalTaxPercentage, [s.minTax]] : [];
  pct.datasets.forEach((d, i) => { d.data = pctSeries[i] ?? []; });
  sumChart.update();
  percentageChart.update();
}

// ---------------------------------------------------------------------------
// Remembering data, saved scenarios, export and import
// ---------------------------------------------------------------------------

let scenarios = []; // [{ name, savedAt, state }]
let currentResult = null;
let restoring = false; // true while applyState fills the form
let saveTimer = null;

// Saves the current form and the scenarios in this browser (nothing is sent anywhere).
// A page with only default values and no scenarios leaves nothing stored.
function scheduleSave() {
  if (restoring) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}

function saveNow() {
  const state = readState();
  if (isPristine(state) && scenarios.length === 0) clearStored();
  else saveStored(makeDocument(state, scenarios));
}

// Fills the form from a state, in dependency order, then recalculates once.
async function applyState(state) {
  restoring = true;
  try {
    yearField.value = state.year ?? '';
    updateYearDependentFields();
    populateKommunDropdown();
    for (const f of FIELDS) {
      if (f.id === 'year') continue;
      const el = $(f.id);
      if (f.type === 'boolean') el.checked = state[f.id];
      else el.value = state[f.id] ?? '';
    }
    $('grossDividends').disabled = state.maxDividend;
    people = structuredClone(state.people);
    const wanted = partPerson(prefs.part);
    selectedPersonId = people.some((p) => p.id === wanted) ? wanted : people[0].id;
    assignments = structuredClone(state.assignments);
    const lookup = writePersonToForm(selectedPerson());
    renderAssignmentCards();
    if (lookup) await lookup;
    selectPart(prefs.part);
    updateTaxRates();
  } finally {
    restoring = false;
  }
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const today = () => new Date().toISOString().slice(0, 10);

function showNotice(message) {
  $('dataNotice').textContent = message;
}

// Key results shown in the scenario table and the CSV scenario block.
const KEY_RESULTS = [
  ['invoicedAmount', 'Fakturerat belopp', 0],
  ['grossSalaryMonth', 'Månadslön brutto', 0],
  ['netSalaryMonth', 'Månadslön netto', 0],
  ['pension', 'Tjänstepension per år', 0],
  ['netDividends', 'Årsutdelning netto', 0],
  ['netSumMonth', 'Månadssumma (lön + utdelning) netto', 0],
  ['totalTax', 'Total skatt*', 0],
  ['totalTaxPercentage', 'Total skatt* (%)', 1],
  ['profitAfterDividends', 'Årets resultat efter utdelning', 0],
];
const KEY_INPUTS = [
  [(s) => s.year, 'Räkenskapsår'],
  [(s) => (s.assignments.length === 1 ? s.assignments[0].hourlyRate : `${s.assignments.length} uppdrag`), 'Timpris'],
];

// Scenario comparison and the CSV scenario block: the first person and the company.
async function resultForState(state) {
  try {
    return viewFor((await calculateState(state)).result, 0);
  } catch {
    return null;
  }
}

const sv = (value, decimals = 0) => (Number.isFinite(value)
  ? value.toLocaleString('sv-SE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  : '–');

let renderCounter = 0;
async function renderScenarios() {
  const id = ++renderCounter;
  const results = await Promise.all(scenarios.map((s) => resultForState(s.state)));
  if (id !== renderCounter) return;
  const table = $('scenarioTable');
  table.replaceChildren();
  $('scenarioEmpty').hidden = scenarios.length > 0;
  table.hidden = scenarios.length === 0;
  if (!scenarios.length) return;

  const current = readState();
  const currentView = viewFor(currentResult, 0);
  const columns = [{ name: 'Nuvarande', state: current, result: currentView }, ...scenarios.map((s, i) => ({ ...s, result: results[i], index: i }))];

  const head = table.createTHead().insertRow();
  head.append(document.createElement('th'));
  for (const col of columns) {
    const th = document.createElement('th');
    th.scope = 'col';
    const name = document.createElement('div');
    name.textContent = col.name;
    th.append(name);
    if (col.index !== undefined) {
      const load = document.createElement('button');
      load.type = 'button';
      load.textContent = 'Ladda';
      load.addEventListener('click', () => loadScenario(col.index));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Ta bort';
      remove.addEventListener('click', () => removeScenario(col.index));
      th.append(load, ' ', remove);
    }
    head.append(th);
  }
  const body = table.createTBody();
  const addRow = (label, cells) => {
    const tr = body.insertRow();
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = label;
    tr.append(th);
    for (const c of cells) {
      const td = tr.insertCell();
      td.textContent = c.text;
      if (c.diff) {
        const small = document.createElement('small');
        small.className = 'diff';
        small.textContent = c.diff;
        td.append(document.createElement('br'), small);
      }
    }
  };
  for (const [get, label] of KEY_INPUTS) {
    addRow(label, columns.map((c) => ({ text: get(c.state) === null ? '–' : String(get(c.state)) })));
  }
  for (const [key, label, decimals] of KEY_RESULTS) {
    const base = currentView?.[key];
    addRow(label, columns.map((c, i) => {
      const v = c.result?.[key];
      const d = v - base;
      const diff = i > 0 && Number.isFinite(d) && Math.abs(d) >= 0.5 * 10 ** -decimals
        ? `${d > 0 ? '+' : '−'}${sv(Math.abs(d), decimals)}`
        : '';
      return { text: sv(v, decimals), diff };
    }));
  }
}

async function saveScenario() {
  const input = $('scenarioName');
  const name = input.value.trim().slice(0, 80) || `Scenario ${scenarios.length + 1}`;
  const entry = { name, savedAt: new Date().toISOString(), state: readState() };
  const existing = scenarios.findIndex((s) => s.name === name);
  if (existing >= 0) {
    if (!(await ask(`Det finns redan ett scenario som heter "${name}". Vill du ersätta det?`, 'Ersätt'))) return;
    scenarios[existing] = entry;
  } else {
    scenarios.push(entry);
  }
  input.value = '';
  showNotice(`Sparade scenariot "${name}".`);
  renderScenarios();
  saveNow();
}

async function loadScenario(index) {
  const s = scenarios[index];
  await applyState(s.state);
  showNotice(`Laddade scenariot "${s.name}".`);
  saveNow();
}

async function removeScenario(index) {
  const s = scenarios[index];
  if (!(await ask(`Ta bort scenariot "${s.name}"?`, 'Ta bort'))) return;
  scenarios.splice(index, 1);
  showNotice(`Tog bort scenariot "${s.name}".`);
  renderScenarios();
  saveNow();
}

function exportJson() {
  const json = JSON.stringify(makeDocument(readState(), scenarios), null, 2);
  download(`budgetkalkyl-${today()}.json`, json, 'application/json');
  showNotice('Dina uppgifter har exporterats till en fil.');
}

async function importJson(file) {
  try {
    const { current, scenarios: imported, invalid } = parseDocument(await file.text());
    const what = imported.length ? ` och ${imported.length} sparade scenarier` : '';
    if (!(await ask(`Ersätta det du har fyllt i nu med uppgifterna i filen${what}?`, 'Ersätt'))) return;
    scenarios = imported;
    await applyState(current);
    saveNow();
    showNotice(`Uppgifterna har importerats${invalid ? ` (${invalid} ogiltiga värden ersattes med standardvärden)` : ''}.`);
  } catch (error) {
    showNotice(error.name === 'ScenarioFormatError' ? error.message : 'Filen kunde inte läsas.');
  }
}

const explanationText = (id) => {
  const e = EXPLANATIONS[id];
  return e ? [e.what, e.formula].filter(Boolean).join(' ') : '';
};

const labelText = (label) => {
  const copy = label.cloneNode(true);
  copy.querySelectorAll('button').forEach((b) => b.remove());
  return copy.textContent.replace(/^\s*→\s*/, '').replace(/\s+/g, ' ').trim();
};

function partRows(part) {
  const rows = [];
  const heading = part.querySelector('h2').cloneNode(true);
  heading.querySelectorAll('.badge').forEach((b) => b.remove());
  const section = heading.textContent.replace(/\s+/g, ' ').trim();
  for (const label of part.querySelectorAll('label[for]')) {
    const field = $(label.htmlFor);
    if (!field || field.dataset.mirror || field.closest('[hidden]')) continue;
    let value;
    if (field.type === 'checkbox') value = field.checked ? 'Ja' : 'Nej';
    else if (field.tagName === 'SELECT') value = field.selectedIndex >= 0 && !field.selectedOptions[0].disabled ? field.selectedOptions[0].text : '';
    else if (field.tagName === 'OUTPUT') value = field.dataset.value === '' || field.dataset.value === undefined ? null : Number(field.dataset.value);
    else if (field.type === 'number') value = field.value === '' ? null : Number(field.value);
    else value = field.value;
    const calculated = field.tagName === 'OUTPUT' || field.disabled;
    rows.push([section, labelText(label), value, calculated ? 'Beräknat' : 'Inmatning', explanationText(field.dataset.explain ?? field.id)]);
  }
  return rows;
}

// One row per field in the structure, part by part, with its explanation. The person
// cards are listed once per person.
const PERSON_PARTS = ['lon', 'pension', 'utdelning', 'annan', 'person'];
function pageRows() {
  const rows = [['Allmänt', 'Inkomstår', Number(yearField.value) || null, 'Inmatning', explanationText('year')]];
  const parts = [...document.querySelectorAll('#parts .part')];
  for (const part of parts.filter((x) => !PERSON_PARTS.includes(x.dataset.part))) rows.push(...partRows(part));
  const original = selectedPersonId;
  syncFormToPerson();
  for (const p of people) {
    if (p.id !== selectedPersonId) {
      selectedPersonId = p.id;
      writePersonToForm(p);
      forsamlingRequest++; // the stored församling is enough here
      writeFields(viewFor(currentResult, selectedIndex()));
    }
    for (const part of parts.filter((x) => PERSON_PARTS.includes(x.dataset.part) && !x.hidden)) rows.push(...partRows(part));
  }
  if (selectedPersonId !== original) {
    selectedPersonId = original;
    writePersonToForm(selectedPerson());
    writeFields(viewFor(currentResult, selectedIndex()));
  }
  return rows;
}

async function exportCsv() {
  const rows = [
    ['Budgetkalkylator för konsulter'],
    ['Källa', location.origin + location.pathname],
    ['Exporterad', new Date().toLocaleString('sv-SE')],
    ['Uppgifterna exporterades från din webbläsare. Inget har skickats någonstans.'],
    ['Observera: beräkningen är en uppskattning. Vi tar inte ansvar för några misstag eller fel.'],
    [],
    ['Avsnitt', 'Fält', 'Värde', 'Typ', 'Förklaring'],
    ...pageRows(),
  ];
  if (scenarios.length) {
    const results = await Promise.all(scenarios.map((s) => resultForState(s.state)));
    const round = (v, d) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null);
    rows.push([], ['Sparade scenarier'], ['Fält', 'Nuvarande', ...scenarios.map((s) => s.name)]);
    const current = readState();
    for (const [get, label] of KEY_INPUTS) rows.push([label, get(current), ...scenarios.map((s) => get(s.state))]);
    for (const [key, label, d] of KEY_RESULTS) {
      rows.push([label, round(viewFor(currentResult, 0)?.[key], d), ...results.map((r) => round(r?.[key], d))]);
    }
  }
  download(`budgetkalkyl-${today()}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  showNotice('Beräkningen har exporterats till en CSV-fil som kan öppnas i Excel.');
}

async function clearData() {
  if (!(await ask('Rensa allt du har fyllt i och alla sparade scenarier från den här webbläsaren?', 'Rensa'))) return;
  scenarios = [];
  clearStored();
  await applyState(defaultState());
  clearStored();
  // Also forget page preferences, so nothing at all is left in this browser.
  Object.assign(prefs, { part: 'uppdrag', howtoClosed: false });
  selectPart('uppdrag');
  $('howto').hidden = false;
  renderStructure();
  clearPrefs();
  showNotice('Dina uppgifter har rensats från den här webbläsaren.');
}

$('saveScenario').addEventListener('click', saveScenario);
$('scenarioName').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveScenario(); });
$('exportJson').addEventListener('click', exportJson);
$('exportCsv').addEventListener('click', exportCsv);
$('importJson').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) importJson(file);
});
$('clearData').addEventListener('click', clearData);

// ---------------------------------------------------------------------------
// Structure: map, selected part, explanations, modes
// ---------------------------------------------------------------------------

const prefs = { part: 'uppdrag', mode: 'structure', howtoClosed: false, ...loadPrefs() };
const narrow = () => window.matchMedia('(max-width: 899px)').matches;

function renderStructure() {
  const result = currentResult;
  const structure = buildStructure({
    assignments: assignments.map((a, i) => {
      const rev = lastRevenue.assignments.find((x) => x.id === a.id);
      const rates = [a.hourlyRate, ...a.priceChanges.map((c) => c.hourlyRate)].filter(Number.isFinite);
      return {
        id: a.id,
        name: assignmentName(a, i),
        rates,
        amount: rev?.amount,
        manual: a.manualAmount !== null,
      };
    }),
    profitAfterTax: result?.company.profitAfterTax,
    otherOwners: result?.company.otherOwnersShare > 0
      ? { share: 100 * result.company.otherOwnersShare, grossDividends: result.company.otherOwnersDividends }
      : null,
    people: people.map((p, i) => {
      const r = result?.people[i] ?? {};
      return {
        id: p.id,
        name: personName(p, i),
        employed: p.employed,
        owner: p.ownership > 0,
        ownership: p.ownership,
        grossSalaryYear: r.grossSalaryYear,
        pension: r.pension,
        grossDividends: r.grossDividends,
        netSumMonth: r.netSumMonth,
        otherEmployer: personOtherEmployer(p),
        otherSalaryYear: p.otherSalaryYear || 0,
      };
    }),
  });
  $('structureMap').innerHTML = renderMap(structure, prefs.part);
  $('structureTree').innerHTML = renderFlowList(structure, prefs.part);
}

// Scrolls so the card's heading is just below anything that stays on top of the screen
// (the summary bar on tablets), and only if the heading is not already in view.
function scrollToCard(card) {
  const summary = document.querySelector('.summary');
  const coveredTop = getComputedStyle(summary).position === 'sticky' ? summary.getBoundingClientRect().bottom : 0;
  const top = card.getBoundingClientRect().top;
  const target = top - Math.max(0, coveredTop) - 8;
  const alreadyVisible = top >= coveredTop && top < window.innerHeight * 0.5;
  if (!alreadyVisible) window.scrollBy({ top: target, behavior: 'smooth' });
}

// Person parts: "lon" (the selected person) or "lon-p2" (person p2). Returns the person
// id in a part name, or null.
const PERSON_PART = /^(person|lon|pension|utdelning|annan)(?:-([a-z0-9]+))?$/;
function partPerson(part) {
  const m = PERSON_PART.exec(part ?? '');
  return m ? m[2] ?? selectedPersonId : null;
}

function selectPart(part, { scroll = false } = {}) {
  // "uppdrag" and "faktura" (older links and saved preferences) mean the first assignment.
  if (part === 'uppdrag' || part === 'faktura') part = `${part}-${assignments[0].id}`;
  let cardPart = part;
  const m = PERSON_PART.exec(part ?? '');
  if (m) {
    const id = people.some((p) => p.id === m[2]) ? m[2] : selectedPersonId;
    switchPerson(id);
    cardPart = m[1];
    part = `${cardPart}-${id}`;
  }
  const card = document.querySelector(`.part[data-part="${cardPart}"]`);
  if (!card) {
    cardPart = `uppdrag-${assignments[0].id}`;
    part = cardPart;
  } else if (card.hidden) {
    cardPart = 'person';
    part = `person-${selectedPersonId}`;
  }
  prefs.part = part;
  savePrefs(prefs);
  for (const el of document.querySelectorAll('.part')) el.classList.toggle('active', el.dataset.part === cardPart);
  renderStructure();
  if (m && !restoring) updateAll();
  if (scroll && narrow()) scrollToCard(document.querySelector(`.part[data-part="${cardPart}"]`));
}

function setMode(mode) {
  prefs.mode = mode;
  savePrefs(prefs);
  $('structureMode').hidden = mode !== 'structure';
  $('quickMode').hidden = mode !== 'quick';
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', b.dataset.mode === mode);
  if (mode === 'quick') quick.refresh();
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-goto]');
  if (!target) return;
  e.preventDefault();
  if (prefs.mode !== 'structure') setMode('structure');
  selectPart(target.dataset.goto, { scroll: true });
});
document.addEventListener('keydown', (e) => {
  const target = e.target.closest?.('[data-goto][role="button"]');
  if (target && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    selectPart(target.dataset.goto, { scroll: true });
  }
});
for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));
$('closeHowto').addEventListener('click', () => {
  $('howto').hidden = true;
  prefs.howtoClosed = true;
  savePrefs(prefs);
});

// ⓘ buttons with an explanation popover, added to every label that has an explanation.
const popover = $('popover');
function closePopover() {
  popover.hidden = true;
  popover.replaceChildren();
}
function openPopover(button, id, label) {
  const e = EXPLANATIONS[id];
  const title = labelText(label);
  const h = Object.assign(document.createElement('h3'), { textContent: title });
  const what = Object.assign(document.createElement('p'), { textContent: e.what });
  popover.replaceChildren(h, what);
  if (e.formula) popover.append(Object.assign(document.createElement('p'), { className: 'formula', textContent: e.formula }));
  if (e.source) {
    const p = document.createElement('p');
    const a = Object.assign(document.createElement('a'), { href: e.source[1], textContent: `${e.source[0]} ↗`, target: '_blank', rel: 'noopener' });
    p.append('Källa: ', a);
    popover.append(p);
  }
  popover.hidden = false;
  popoverScrollY = window.scrollY;
  const r = button.getBoundingClientRect();
  const left = Math.min(window.innerWidth - popover.offsetWidth - 8, Math.max(8, r.left - 20));
  const below = r.bottom + 8 + popover.offsetHeight <= window.innerHeight;
  popover.style.left = `${left}px`;
  popover.style.top = `${below ? r.bottom + 8 : Math.max(8, r.top - popover.offsetHeight - 8)}px`;
}
// Adds an ⓘ button to every label in `root` whose field has an explanation (looked up by
// the field's data-explain, or its id).
function addInfoButtons(root) {
  for (const label of root.querySelectorAll('label[for]')) {
    if (label.querySelector('.info')) continue;
    const field = document.getElementById(label.htmlFor);
    const key = field?.dataset.explain ?? label.htmlFor;
    if (!EXPLANATIONS[key]) continue;
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'info', textContent: 'i' });
    b.setAttribute('aria-label', `Förklaring: ${label.textContent.trim()}`);
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!popover.hidden && popover.dataset.for === label.htmlFor) return closePopover();
      popover.dataset.for = label.htmlFor;
      openPopover(b, key, label);
    });
    // Put the button right after the label text (before any "från …" chip).
    const chip = label.querySelector('.from');
    if (chip) chip.before(b, ' ');
    else label.append(' ', b);
  }
}
addInfoButtons(document);
document.addEventListener('click', (e) => {
  if (!popover.hidden && !popover.contains(e.target) && !e.target.closest('.info')) closePopover();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopover(); });
// Close when the page has really moved, not on a small scroll that is still settling.
let popoverScrollY = 0;
window.addEventListener('scroll', () => {
  if (!popover.hidden && Math.abs(window.scrollY - popoverScrollY) > 40) closePopover();
}, { passive: true });

// Quick calculators.
const quick = initQuick({
  kommunRates: () => kommunRates,
  engineData,
  ensureGrundavdragTable,
  setOutput,
  structureSummary: () => {
    syncFormToPerson();
    return {
      netSumMonth: viewFor(currentResult, 0)?.netSumMonth,
      year: Number(yearField.value) || null,
      yearBorn: people[0].yearBorn,
      kommun: people[0].kommun || null,
    };
  },
  // The quick calculators fill in the first person.
  async onConnect(kind, v) {
    const state = readState();
    const p = state.people[0];
    const parts = { privat: 'person', faktura: 'uppdrag', grans: 'utdelning', kostnad: 'lon' };
    if (kind === 'privat') {
      state.year = v.year;
      Object.assign(p, { yearBorn: v.yearBorn, kommun: v.kommun, grossSalaryMonth: Math.round(v.income / 12), salaryMonths: 12, useSemesterersattning: false, useMaxGrossSalary: false, employed: true });
    }
    if (kind === 'faktura') {
      p.vacationDays = v.vacationDays;
      state.assignments = [{ ...defaultAssignment('a1', 2026, p.id), hourlyRate: v.hourlyRate, startDate: v.billingStartDate, endDate: v.billingEndDate, workingRate: v.workingRate }];
    }
    if (kind === 'grans') {
      state.year = v.year;
      Object.assign(p, { omkostnadsbelopp: v.omkostnadsbelopp, savedDividends: v.savedDividends });
    }
    if (kind === 'kostnad') Object.assign(p, { grossSalaryMonth: v.grossSalaryMonth, usePension: v.usePension, pensionPercent: 4.7, useMaxGrossSalary: false, employed: true });
    for (const obj of [state, p]) {
      for (const [k, val] of Object.entries(obj)) if (typeof val === 'number' && !Number.isFinite(val)) obj[k] = null;
    }
    if (p.kommun !== people[0].kommun) { p.forsamling = ''; p.kyrkoavgift = null; }
    setMode('structure');
    prefs.part = `${parts[kind]}-${p.id}`;
    await applyState(state);
    selectPart(kind === 'faktura' ? 'uppdrag' : `${parts[kind]}-${p.id}`, { scroll: true });
    showNotice('Snabbräknarens värden finns nu i din struktur.');
  },
});

// Charts follow the light/dark colour scheme.
function applyChartTheme() {
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue('--muted').trim();
  const line = css.getPropertyValue('--line').trim();
  Chart.defaults.color = text;
  Chart.defaults.borderColor = line;
  for (const chart of [sumChart, percentageChart]) chart.update('none');
  series.nodes.labels.template.set('fill', am5.color(css.getPropertyValue('--text').trim()));
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyChartTheme);

// Visitor statistics: GoatCounter counts page views without cookies or personal data.
// Fill in the site code (from goatcounter.com) to turn it on. No other events are sent.
// Statistics: https://mikaeltulldahl.goatcounter.com
const GOATCOUNTER_CODE = 'mikaeltulldahl';
if (GOATCOUNTER_CODE && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  const script = document.createElement('script');
  script.async = true;
  script.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
  script.src = 'https://gc.zgo.at/count.v4.js';
  document.head.append(script);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function init() {
  applyChartTheme();
  const initialPart = prefs.part; // may name a person who exists only in the saved data
  selectPart(prefs.part);
  $('howto').hidden = prefs.howtoClosed;
  yearField.min = FIRST_YEAR;
  yearField.max = LAST_YEAR;
  $('yearBorn').max = LAST_YEAR;
  updateYearDependentFields();
  try {
    kommunRates = await loadJson('data/kommuner.json');
  } catch (error) {
    console.error(error);
    setStatus('kommuner', 'Kunde inte läsa in kommunernas skattesatser. Ladda om sidan.');
  }
  let restored = null;
  const stored = loadStored();
  if (stored) {
    try {
      restored = parseDocument(stored);
    } catch {
      clearStored(); // unreadable data from an older or broken version
    }
  }
  if (restored) {
    scenarios = restored.scenarios;
    prefs.part = initialPart;
    await applyState(restored.current);
  } else {
    populateKommunDropdown();
    writePersonToForm(selectedPerson());
    renderAssignmentCards();
    selectPart(prefs.part);
    updateAll();
  }
  setMode(prefs.mode === 'quick' ? 'quick' : 'structure');
}
init();
