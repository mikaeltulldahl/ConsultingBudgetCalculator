// Page logic: reads the form, runs the engine and writes results and charts.
// All tax maths lives in engine.js; this file only deals with the page.
import { calculate, salarySweep, billableHours } from './engine.js';
import { EXPLANATIONS } from './explanations.js';
import { buildStructure, renderMap, renderFlowList } from './structure.js';
import { initQuick } from './quick.js';
import { FIRST_YEAR, LAST_YEAR, UnsupportedYearError, getYearParams } from './params.js';
import { grundavdragGroup } from './grundavdrag.js';
import {
  FIELDS, defaultState, makeDocument, parseDocument, isPristine, toEngineInputs, toCsv,
} from './scenario.js';
import { loadStored, saveStored, clearStored, loadPrefs, savePrefs, clearPrefs } from './storage.js';

const $ = (id) => document.getElementById(id);

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
async function populateForsamling(preferred = null) {
  if (!churchMemberField.checked || !validKommun()) return;
  const selected = preferred?.name ?? forsamlingSelector.selectedOptions[0]?.text;
  forsamlingSelector.innerHTML = '';
  const placeholder = new Option('--- VÄLJ FÖRSAMLING---', '', true, true);
  placeholder.disabled = true;
  forsamlingSelector.add(placeholder);
  forsamlingSelector.disabled = false;
  try {
    const url = `${KYRKOAVGIFT_DATASET}?_limit=500&kommun=${encodeURIComponent(kommunSelector.value)}&%C3%A5r=${yearField.value}`;
    const data = await loadJson(url);
    for (const row of data.results) {
      const name = row['församling'];
      forsamlingSelector.add(new Option(name, row.kyrkoavgift, false, name === selected));
    }
    setStatus('forsamling', null);
  } catch (error) {
    console.error(error);
    setStatus('forsamling', 'Kunde inte hämta församlingar från Skatteverket. Försök igen senare.');
    if (preferred?.name && preferred.rate !== null) {
      forsamlingSelector.add(new Option(preferred.name, preferred.rate, false, true));
    }
  }
  updateTaxRates();
}

// Fills the (read-only) rate fields from the bundled kommun data and the chosen församling.
function updateTaxRates() {
  const rates = validKommun() ? ratesForYear(parseInt(yearField.value))?.[kommunSelector.value] : null;
  setRate('kommunalSkattPercent', rates ? rates[0] : '');
  setRate('burialSkattPercent', rates ? rates[1] : '');
  setRate('churchSkattPercent', churchMemberField.checked && validForsamling() ? forsamlingSelector.value : '');
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
// Uppdrag: billable hours and invoiced amount
// ---------------------------------------------------------------------------

const billableHoursField = $('billableHours');

function updateBillableHours() {
  const start = $('billingStartDate').value;
  const end = $('billingEndDate').value;
  const rate = $('workingRate').value;
  const vacation = $('vacationDays').value;
  billableHoursField.value = start && end && rate && vacation
    ? billableHours({ startDate: start, endDate: end, workingRatePercent: parseInt(rate), vacationDays: parseInt(vacation) })
    : 0;
  updateInvoicedAmount();
}

function updateInvoicedAmount() {
  const rate = parseInt($('hourlyRate').value);
  const hours = parseInt(billableHoursField.value);
  setOutput('invoicedAmount', isNaN(rate) || isNaN(hours) ? 0 : rate * hours);
  updateAll();
}

// The company can use its own invoiced amount instead of the one from Uppdrag.
function syncManualInvoiced() {
  const manual = $('manualInvoicedAmount').value !== '';
  $('manualInvoicedRow').hidden = !manual;
  $('invoicedLink').classList.toggle('manual', manual);
  $('toggleManualInvoiced').textContent = manual ? 'Använd beloppet från Uppdrag igen' : 'Ange eget belopp i stället';
}
$('toggleManualInvoiced').addEventListener('click', () => {
  const field = $('manualInvoicedAmount');
  if (field.value === '') {
    field.value = $('invoicedAmount').dataset.value || 0;
    syncManualInvoiced();
    field.focus();
    field.select();
  } else {
    field.value = '';
    syncManualInvoiced();
  }
  updateAll();
});
$('manualInvoicedAmount').addEventListener('input', updateAll);

for (const id of ['billingStartDate', 'billingEndDate', 'workingRate', 'vacationDays']) {
  $(id).addEventListener('input', updateBillableHours);
}
billableHoursField.addEventListener('input', updateInvoicedAmount);
$('hourlyRate').addEventListener('input', updateInvoicedAmount);

// ---------------------------------------------------------------------------
// Main update
// ---------------------------------------------------------------------------

// The value of every editable field (see FIELDS in scenario.js).
function readState() {
  const state = {};
  for (const f of FIELDS) {
    const el = $(f.id);
    if (!el || ['kommun', 'forsamling', 'kyrkoavgift'].includes(f.id)) continue;
    if (f.type === 'boolean') state[f.id] = el.checked;
    else if (f.type === 'number') state[f.id] = el.value === '' || isNaN(Number(el.value)) ? null : Number(el.value);
    else state[f.id] = el.value;
  }
  state.kommun = validKommun() ? kommunSelector.value : '';
  const forsamling = churchMemberField.checked && validForsamling();
  state.forsamling = forsamling ? forsamlingSelector.selectedOptions[0].text : '';
  state.kyrkoavgift = forsamling ? parseFloat(forsamlingSelector.value) : null;
  return state;
}

function readInputs() {
  return toEngineInputs(readState(), kommunRates);
}

// Output field id -> decimals.
const OUTPUTS = {
  grossSemesterersattning: 0, grossSalaryYear: 0, grundavdrag: 0, kommunalSkatt: 0, statligSkatt: 0,
  burialSkatt: 0, publicServiceSkatt: 0, jobbskatteavdrag: 0, skattereduktionForvarvsinkomst: 0,
  incomeTax: 0, netSalaryYear: 0, netSemesterersattning: 0, netSalaryMonth: 0, incomeTaxPercentage: 1,
  pension: 0, insurance: 0, slp: 0, arbetsgivaravgift: 0, totalCost: 0, profitBeforeTax: 0,
  profitAfterTax: 0, omkostnadsbeloppInterest: 0, salaryBasedLimit: 0, grundbelopp: 0,
  dividendsLimitForenklingsregeln: 0, dividendsLimitHuvudregeln: 0, dividendsLimit: 0, grossDividends: 0,
  netDividends: 0, profitAfterDividends: 0, netSumMonth: 0, totalTax: 0, bolagsTaxExclDividends: 0,
  totalTaxPercentage: 1,
};

const format = (value, decimals) => (Number.isFinite(value) ? value.toFixed(decimals) : '');

function writeFields(r) {
  for (const [id, decimals] of Object.entries(OUTPUTS)) {
    if (id === 'grossDividends') continue; // an input field, see below
    setOutput(id, r?.[id], decimals);
  }
  for (const el of document.querySelectorAll('output[data-mirror]')) setOutput(el, r?.[el.dataset.mirror], 0);
  setOutput('usedInvoicedAmount', r?.invoicedAmount);
  setOutput('churchSkatt', churchMemberField.checked ? r?.churchSkatt : NaN);
  $('grossDividends').value = format(r?.grossDividends, 0);
  if ($('useMaxGrossSalary').checked) $('grossSalaryMonth').value = format(r?.grossSalaryMonth, 0);
  $('grossDividends').max = format(r?.dividendsLimit, 0);

  const kr = (v) => (Number.isFinite(v) ? `${Math.round(v).toLocaleString('sv-SE')} kr` : '–');
  $('sumNetMonth').textContent = kr(r?.netSumMonth);
  $('sumTaxPct').textContent = Number.isFinite(r?.totalTaxPercentage) ? `${r.totalTaxPercentage.toLocaleString('sv-SE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %` : '–';
  $('sumLeft').textContent = kr(r?.profitAfterDividends);
  $('sumInvoiced').textContent = kr(r?.invoicedAmount);
  $('summaryHint').hidden = Number.isFinite(r?.netSumMonth);
}

function updateYearDependentFields() {
  const year = parseInt(yearField.value);
  $('dividendLimitsContainer').hidden = year >= 2026;
  $('grundbeloppContainer').hidden = year < 2026;
}

let updateCounter = 0;
async function updateAll() {
  const id = ++updateCounter;
  const inputs = readInputs();
  let result = null;
  try {
    const p = getYearParams(inputs.year);
    const age = inputs.year - inputs.yearBorn - 1;
    if (!isNaN(age)) await ensureGrundavdragTable(inputs.year, grundavdragGroup(age, p.forhojtGrundavdragAge));
    if (id !== updateCounter) return; // a newer update has started
    result = calculate(inputs, engineData);
    setStatus('calculation', null);
  } catch (error) {
    if (id !== updateCounter) return;
    if (!(error instanceof UnsupportedYearError)) console.error(error);
    setStatus('calculation', error instanceof UnsupportedYearError
      ? error.message
      : 'Något gick fel i beräkningen. Ladda om sidan och försök igen.');
  }
  writeFields(result);
  updateCharts(result);
  updateSankeyChartData(result ?? {});
  currentResult = result;
  renderStructure();
  renderScenarios();
  scheduleSave();
}

for (const id of ['yearBorn', 'grossSalaryMonth', 'salaryMonths', 'otherRevenue', 'otherCosts',
  'grossDividends', 'savedDividends', 'omkostnadsbelopp']) {
  $(id).addEventListener('input', updateAll);
}
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
    { from: invoicedAmountStr, to: revenueStr, value: Math.round(f.invoicedAmount), label: 'Fakturerat belopp' },
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

function updateCharts(result) {
  const s = result ? salarySweep(result, engineData) : null;
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
    kommunSelector.value = state.kommun;
    if (kommunSelector.selectedIndex < 0) kommunSelector.selectedIndex = 0;
    for (const f of FIELDS) {
      const el = $(f.id);
      if (!el || ['year', 'kommun', 'forsamling', 'kyrkoavgift', 'billableHours'].includes(f.id)) continue;
      if (f.type === 'boolean') el.checked = state[f.id];
      else el.value = state[f.id] ?? '';
    }
    syncManualInvoiced();
    $('grossSalaryMonth').disabled = state.useMaxGrossSalary;
    $('grossDividends').disabled = state.maxDividend;
    $('forsamling').hidden = !state.churchMember;
    forsamlingSelector.innerHTML = '';
    forsamlingSelector.add(new Option('--- VÄLJ FÖRSAMLING---', '', true, true));
    if (state.churchMember && validKommun()) {
      await populateForsamling({ name: state.forsamling, rate: state.kyrkoavgift });
    }
    if (state.billableHours === null) {
      updateBillableHours();
    } else {
      billableHoursField.value = state.billableHours;
      updateInvoicedAmount();
    }
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
  ['year', 'Räkenskapsår'],
  ['hourlyRate', 'Timpris'],
];

async function resultForState(state) {
  try {
    const inputs = toEngineInputs(state, kommunRates);
    const p = getYearParams(inputs.year);
    const age = inputs.year - inputs.yearBorn - 1;
    if (!isNaN(age)) await ensureGrundavdragTable(inputs.year, grundavdragGroup(age, p.forhojtGrundavdragAge));
    return calculate(inputs, engineData);
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
  const columns = [{ name: 'Nuvarande', state: current, result: currentResult }, ...scenarios.map((s, i) => ({ ...s, result: results[i], index: i }))];

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
  for (const [key, label] of KEY_INPUTS) {
    addRow(label, columns.map((c) => ({ text: c.state[key] === null ? '–' : String(c.state[key]) })));
  }
  for (const [key, label, decimals] of KEY_RESULTS) {
    const base = currentResult?.[key];
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

function saveScenario() {
  const input = $('scenarioName');
  const name = input.value.trim().slice(0, 80) || `Scenario ${scenarios.length + 1}`;
  const entry = { name, savedAt: new Date().toISOString(), state: readState() };
  const existing = scenarios.findIndex((s) => s.name === name);
  if (existing >= 0) {
    if (!confirm(`Det finns redan ett scenario som heter "${name}". Vill du ersätta det?`)) return;
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

function removeScenario(index) {
  const s = scenarios[index];
  if (!confirm(`Ta bort scenariot "${s.name}"?`)) return;
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
    if (!confirm(`Ersätta det du har fyllt i nu med uppgifterna i filen${what}?`)) return;
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

// One row per field in the structure, part by part, with its explanation.
function pageRows() {
  const rows = [['Allmänt', 'Inkomstår', Number(yearField.value) || null, 'Inmatning', explanationText('year')]];
  for (const part of document.querySelectorAll('#parts .part')) {
    const section = part.querySelector('h2').firstChild.textContent.trim();
    for (const label of part.querySelectorAll('label[for]')) {
      const field = $(label.htmlFor);
      if (!field || field.dataset.mirror || field.closest('[hidden]')) continue;
      let value;
      if (field.type === 'checkbox') value = field.checked ? 'Ja' : 'Nej';
      else if (field.tagName === 'SELECT') value = field.selectedIndex > 0 ? field.selectedOptions[0].text : '';
      else if (field.tagName === 'OUTPUT') value = field.dataset.value === '' || field.dataset.value === undefined ? null : Number(field.dataset.value);
      else if (field.type === 'number') value = field.value === '' ? null : Number(field.value);
      else value = field.value;
      const text = [...label.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(' ');
      const name = text.replace(/^\s*→\s*/, '').replace(/\s+/g, ' ').trim();
      const calculated = field.tagName === 'OUTPUT' || field.disabled;
      rows.push([section, name, value, calculated ? 'Beräknat' : 'Inmatning', explanationText(field.id)]);
    }
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
    for (const [key, label] of KEY_INPUTS) rows.push([label, current[key], ...scenarios.map((s) => s.state[key])]);
    for (const [key, label, d] of KEY_RESULTS) {
      rows.push([label, round(currentResult?.[key], d), ...results.map((r) => round(r?.[key], d))]);
    }
  }
  download(`budgetkalkyl-${today()}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  showNotice('Beräkningen har exporterats till en CSV-fil som kan öppnas i Excel.');
}

async function clearData() {
  if (!confirm('Rensa allt du har fyllt i och alla sparade scenarier från den här webbläsaren?')) return;
  scenarios = [];
  clearStored();
  await applyState(defaultState());
  clearStored();
  // Also forget page preferences, so nothing at all is left in this browser.
  Object.assign(prefs, { part: 'uppdrag', howtoClosed: false });
  for (const el of document.querySelectorAll('.part')) el.classList.toggle('active', el.dataset.part === 'uppdrag');
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
  const r = currentResult ?? {};
  const structure = buildStructure({
    hourlyRate: Number($('hourlyRate').value === '' ? NaN : $('hourlyRate').value),
    invoicedAmount: Number.isFinite(r.invoicedAmount) ? r.invoicedAmount : Number($('invoicedAmount').dataset.value),
    manualInvoiced: $('manualInvoicedAmount').value !== '',
    profitAfterTax: r.profitAfterTax,
    grossSalaryYear: r.grossSalaryYear,
    grossDividends: r.grossDividends,
    netSumMonth: r.netSumMonth,
  });
  $('structureMap').innerHTML = renderMap(structure, prefs.part);
  $('structureTree').innerHTML = renderFlowList(structure, prefs.part);
}

function selectPart(part, { scroll = false } = {}) {
  if (!document.querySelector(`.part[data-part="${part}"]`)) part = 'uppdrag';
  prefs.part = part;
  savePrefs(prefs);
  for (const el of document.querySelectorAll('.part')) el.classList.toggle('active', el.dataset.part === part);
  renderStructure();
  if (scroll && narrow()) document.querySelector(`.part[data-part="${part}"]`).scrollIntoView({ behavior: 'smooth', block: 'start' });
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
function openPopover(button, id) {
  const e = EXPLANATIONS[id];
  const label = document.querySelector(`label[for="${id}"]`);
  const title = [...label.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(' ').replace(/^\s*→\s*/, '').trim();
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
  const r = button.getBoundingClientRect();
  const left = Math.min(window.innerWidth - popover.offsetWidth - 8, Math.max(8, r.left - 20));
  const below = r.bottom + 8 + popover.offsetHeight <= window.innerHeight;
  popover.style.left = `${left}px`;
  popover.style.top = `${below ? r.bottom + 8 : Math.max(8, r.top - popover.offsetHeight - 8)}px`;
}
for (const label of document.querySelectorAll('label[for]')) {
  const key = EXPLANATIONS[label.htmlFor] ? label.htmlFor : null;
  if (!key) continue;
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'info', textContent: 'i' });
  b.setAttribute('aria-label', `Förklaring: ${label.textContent.trim()}`);
  b.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (!popover.hidden && popover.dataset.for === key) return closePopover();
    popover.dataset.for = key;
    openPopover(b, key);
  });
  // Put the button right after the label text (before any "från …" chip).
  const chip = label.querySelector('.from');
  if (chip) chip.before(b, ' ');
  else label.append(' ', b);
}
document.addEventListener('click', (e) => {
  if (!popover.hidden && !popover.contains(e.target) && !e.target.closest('.info')) closePopover();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopover(); });
window.addEventListener('scroll', closePopover, { passive: true });

// Quick calculators.
const quick = initQuick({
  kommunRates: () => kommunRates,
  engineData,
  ensureGrundavdragTable,
  setOutput,
  structureSummary: () => ({
    netSumMonth: currentResult?.netSumMonth,
    year: Number(yearField.value) || null,
    yearBorn: Number($('yearBorn').value) || null,
    kommun: validKommun() ? kommunSelector.value : null,
  }),
  async onConnect(kind, v) {
    const state = readState();
    const parts = { privat: 'person', faktura: 'uppdrag', grans: 'utdelning', kostnad: 'lon' };
    if (kind === 'privat') Object.assign(state, { year: v.year, yearBorn: v.yearBorn, kommun: v.kommun, grossSalaryMonth: Math.round(v.income / 12), salaryMonths: 12, useSemesterersattning: false, useMaxGrossSalary: false });
    if (kind === 'faktura') Object.assign(state, { hourlyRate: v.hourlyRate, billingStartDate: v.billingStartDate, billingEndDate: v.billingEndDate, vacationDays: v.vacationDays, workingRate: v.workingRate, billableHours: null, manualInvoicedAmount: null });
    if (kind === 'grans') Object.assign(state, { year: v.year, omkostnadsbelopp: v.omkostnadsbelopp, savedDividends: v.savedDividends });
    if (kind === 'kostnad') Object.assign(state, { grossSalaryMonth: v.grossSalaryMonth, usePension: v.usePension, useMaxGrossSalary: false });
    for (const [k, val] of Object.entries(state)) if (typeof val === 'number' && !Number.isFinite(val)) state[k] = null;
    if (state.kommun !== (kommunSelector.value || '')) { state.forsamling = ''; state.kyrkoavgift = null; }
    setMode('structure');
    await applyState(state);
    selectPart(parts[kind], { scroll: true });
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
    await applyState(restored.current);
  } else {
    populateKommunDropdown();
    updateBillableHours();
  }
  setMode(prefs.mode === 'quick' ? 'quick' : 'structure');
}
init();
