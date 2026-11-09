// Page logic: reads the form, runs the engine and writes results and charts.
// All tax maths lives in engine.js; this file only deals with the page.
import { calculate, salarySweep, billableHours } from './engine.js';
import { FIRST_YEAR, LAST_YEAR, UnsupportedYearError, getYearParams } from './params.js';
import { grundavdragGroup } from './grundavdrag.js';

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

async function populateForsamling() {
  if (!churchMemberField.checked || !validKommun()) return;
  const selected = forsamlingSelector.selectedOptions[0]?.text;
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
  }
  updateTaxRates();
}

// Fills the (read-only) rate fields from the bundled kommun data and the chosen församling.
function updateTaxRates() {
  const rates = validKommun() ? ratesForYear(parseInt(yearField.value))?.[kommunSelector.value] : null;
  $('kommunalSkattPercent').value = rates ? rates[0] : '';
  $('burialSkattPercent').value = rates ? rates[1] : '';
  $('churchSkattPercent').value = churchMemberField.checked && validForsamling() ? forsamlingSelector.value : '';
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
  $('invoicedAmount').value = isNaN(rate) || isNaN(hours) ? 0 : rate * hours;
  updateAll();
}

for (const id of ['billingStartDate', 'billingEndDate', 'workingRate', 'vacationDays']) {
  $(id).addEventListener('input', updateBillableHours);
}
billableHoursField.addEventListener('input', updateInvoicedAmount);
$('hourlyRate').addEventListener('input', updateInvoicedAmount);

// ---------------------------------------------------------------------------
// Main update
// ---------------------------------------------------------------------------

function readInputs() {
  const int = (id) => parseInt($(id).value);
  const float = (id) => parseFloat($(id).value);
  return {
    year: int('year'),
    yearBorn: int('yearBorn'),
    kommunalSkattPercent: float('kommunalSkattPercent'),
    burialSkattPercent: float('burialSkattPercent'),
    churchMember: churchMemberField.checked,
    churchSkattPercent: float('churchSkattPercent'),
    useMaxGrossSalary: $('useMaxGrossSalary').checked,
    grossSalaryMonth: int('grossSalaryMonth'),
    salaryMonths: int('salaryMonths'),
    useSemesterersattning: $('useSemesterersattning').checked,
    vacationDays: int('vacationDays'),
    usePension: $('usePension').checked,
    otherCosts: int('otherCosts'),
    otherRevenue: int('otherRevenue'),
    invoicedAmount: int('invoicedAmount'),
    maxDividend: $('maxDividend').checked,
    grossDividends: int('grossDividends'),
    savedDividends: int('savedDividends'),
    omkostnadsbelopp: int('omkostnadsbelopp'),
  };
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
    $(id).value = format(r?.[id], decimals);
  }
  $('churchSkatt').value = churchMemberField.checked ? format(r?.churchSkatt, 0) : '';
  if ($('useMaxGrossSalary').checked) $('grossSalaryMonth').value = format(r?.grossSalaryMonth, 0);
  $('grossDividends').max = format(r?.dividendsLimit, 0);
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
// Start
// ---------------------------------------------------------------------------

async function init() {
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
  populateKommunDropdown();
  updateBillableHours();
}
init();
