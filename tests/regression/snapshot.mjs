// Shared by the snapshot test and the update script: computes the engine output for the
// regression case grid in a compact, JSON-safe form.
import { calculate, salarySweep } from '../../js/engine.js';
import { fixtureData } from '../helpers/data.mjs';
import { generateCases, BASE_INPUT } from '../helpers/cases.mjs';

export const SNAPSHOT_FILE = new URL('./snapshot.json', import.meta.url);

const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : String(x));

const OUTPUTS = [
  'grossSalaryMonth', 'grossSemesterersattning', 'grossSalaryYear', 'grundavdrag', 'kommunalSkatt',
  'statligSkatt', 'burialSkatt', 'churchSkatt', 'publicServiceSkatt', 'jobbskatteavdrag',
  'skattereduktionForvarvsinkomst', 'incomeTax', 'netSalaryYear', 'netSemesterersattning',
  'netSalaryMonth', 'incomeTaxPercentage', 'pension', 'insurance', 'slp', 'arbetsgivaravgift',
  'totalCost', 'profitBeforeTax', 'profitAfterTax', 'omkostnadsbeloppInterest', 'salaryBasedLimit',
  'grundbelopp', 'dividendsLimitForenklingsregeln', 'dividendsLimitHuvudregeln', 'dividendsLimit',
  'grossDividends', 'netDividends', 'profitAfterDividends', 'netSumMonth', 'totalTax',
  'bolagsTaxExclDividends', 'totalTaxPercentage',
];

function sampleIndices(length, count) {
  if (length <= count) return Array.from({ length }, (_, i) => i);
  return Array.from({ length: count }, (_, i) => Math.round(i * (length - 1) / (count - 1)));
}

export function computeSnapshot() {
  const cases = [BASE_INPUT, ...generateCases(150, 7)];
  return cases.map((input) => {
    const result = calculate(input, fixtureData);
    const sweep = salarySweep(result, fixtureData);
    const out = {};
    for (const k of OUTPUTS) out[k] = r2(result[k]);
    return {
      input,
      output: out,
      sweep: sweep && {
        points: sweep.grossSalaryMonth.length,
        maxSum: sweep.maxSum,
        minTax: sweep.minTax,
        // 12 evenly spaced points keep the file small but still catch shape changes.
        sample: sampleIndices(sweep.grossSalaryMonth.length, 12).map((i) => [
          sweep.grossSalaryMonth[i], sweep.netSalaryYear[i], sweep.netDividends[i],
          sweep.totalTax[i], sweep.taxPercentage[i], sweep.marginalTaxPercentage[i] ?? null,
        ]),
      },
    };
  });
}

export function serialize(snapshot) {
  return '[\n' + snapshot.map((s) => JSON.stringify(s)).join(',\n') + '\n]\n';
}
