// Runs the frozen legacy calculation (legacy-calc.js) in a sandbox, with the few DOM
// elements it touches stubbed and Skatteverket's grundavdrag API served from fixtures.
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const here = new URL('./', import.meta.url);
const fixtureDir = new URL('../../data/grundavdrag/', import.meta.url);
const DATASET_GROUP = {
  'ebbd8d70-9b9c-4327-b2ce-a371ee66744c': 'under66',
  '43902bf8-cb34-4288-ab95-2080f8a878dc': 'from66',
};

const tables = {};
for (const name of readdirSync(fixtureDir)) {
  const { year, group, rows } = JSON.parse(readFileSync(new URL(name, fixtureDir), 'utf8'));
  // Back to the API's original string shape.
  tables[`${year}-${group}`] = rows.map(([from, tom, avdrag]) => ({
    'ink from': String(from),
    'ink tom': tom === null ? '' : String(tom),
    'gr avdrag': avdrag === null ? 'FastInk' : String(avdrag),
    'år': String(year),
  }));
}

function fakeFetch(url) {
  const u = new URL(url);
  const id = u.pathname.split('/').pop();
  const group = DATASET_GROUP[id];
  const year = u.searchParams.get('år');
  const offset = parseInt(u.searchParams.get('_offset') ?? '0');
  const limit = parseInt(u.searchParams.get('_limit') ?? '100');
  const rows = tables[`${year}-${group}`] ?? [];
  const results = rows.slice(offset, offset + limit);
  return Promise.resolve({ json: () => Promise.resolve({ results }) });
}

const source = readFileSync(new URL('legacy-calc.js', here), 'utf8');

function makeContext() {
  const ctx = {
    fetch: fakeFetch,
    console,
    useMaxGrossSalaryCheckbox: { checked: false, addEventListener() {} },
    maxDividendCheckbox: { checked: true, addEventListener() {} },
    // In the browser `salaryMonths` resolves to the <input id="salaryMonths"> element
    // (named access on window), which is always truthy.
    salaryMonths: {},
    totalTaxPercentageField: { value: '' },
    chartData: { labels: [], datasets: Array.from({ length: 7 }, () => ({ data: [] })) },
    percentageChartData: { labels: [], datasets: Array.from({ length: 3 }, () => ({ data: [] })) },
    myChart: { update() {} },
    percentageChart: { update() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return ctx;
}

// Same shape as readFields() in the legacy index.html, built from plain inputs.
function readFields(inp) {
  return {
    year: inp.year,
    kommunalSkattPercent: 0.01 * inp.kommunalSkattPercent,
    churchSkattPercent: inp.churchMember ? 0.01 * inp.churchSkattPercent : 0,
    burialSkattPercent: 0.01 * inp.burialSkattPercent,
    age: inp.year - inp.yearBorn - 1,
    grossSemesterersattning: NaN, grossSalaryYear: NaN, grundavdrag: NaN,
    kommunalSkatt: NaN, statligSkatt: NaN, burialSkatt: NaN, churchSkatt: NaN,
    publicServiceSkatt: NaN, jobbskatteavdrag: NaN, skattereduktionForvarvsinkomst: NaN,
    incomeTax: NaN, netSalaryYear: NaN, netSemesterersattning: NaN, netSalaryMonth: NaN,
    incomeTaxPercentage: NaN,
    grossSalaryMonth: inp.grossSalaryMonth,
    salaryMonths: inp.salaryMonths,
    useSemesterersattning: inp.useSemesterersattning,
    vacationDays: inp.vacationDays,
    usePension: inp.usePension,
    otherCosts: inp.otherCosts,
    otherRevenue: inp.otherRevenue,
    invoicedAmount: inp.invoicedAmount,
    pension: NaN, insurance: NaN, slp: NaN, arbetsgivaravgift: NaN, totalCost: NaN,
    profitBeforeTax: NaN, profitAfterTax: NaN,
    grossDividends: inp.grossDividends,
    savedDividends: inp.savedDividends,
    omkostnadsbelopp: inp.omkostnadsbelopp,
    omkostnadsbeloppInterest: NaN, salaryBasedLimit: NaN, grundbelopp: NaN,
    dividendsLimitForenklingsregeln: NaN, dividendsLimitHuvudregeln: NaN, dividendsLimit: NaN,
    netDividends: NaN, profitAfterDividends: NaN, netSumMonth: NaN, totalTax: NaN,
    bolagsTaxExclDividends: NaN, totalTaxPercentage: NaN,
  };
}

// Mirrors updateAll() + updateChart() in the legacy page.
export async function runLegacy(inp) {
  const ctx = makeContext();
  ctx.useMaxGrossSalaryCheckbox.checked = inp.useMaxGrossSalary;
  ctx.maxDividendCheckbox.checked = inp.maxDividend;
  const fields = readFields(inp);
  await ctx.updateSalary(fields);
  ctx.updateResultat(fields);
  ctx.updateDividends(fields);
  ctx.updateConclusion(fields);
  const result = { ...fields };

  let sweep = null;
  if (!isNaN(fields.totalTaxPercentage)) {
    ctx.totalTaxPercentageField.value = fields.totalTaxPercentage.toFixed(1);
    await ctx.updateChart(fields);
    const c = ctx.chartData, p = ctx.percentageChartData;
    const num = (a) => Array.from(a, Number);
    sweep = {
      grossSalaryMonth: num(c.labels),
      netSalaryYear: num(c.datasets[0].data),
      netDividends: num(c.datasets[1].data),
      pension: num(c.datasets[2].data),
      profitAfterDividends: num(c.datasets[3].data),
      totalTax: num(c.datasets[4].data),
      bolagsTaxExclDividends: num(c.datasets[5].data),
      maxSum: { x: Number(c.datasets[6].data[0].x), y: Number(c.datasets[6].data[0].y) },
      taxPercentage: num(p.datasets[0].data),
      marginalTaxPercentage: num(p.datasets[1].data),
      minTax: { x: Number(p.datasets[2].data[0].x), y: Number(p.datasets[2].data[0].y) },
    };
  }
  return { result, sweep };
}
