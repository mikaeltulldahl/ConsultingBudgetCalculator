// Reports how the current engine differs from the original calculator (frozen copy in
// legacy-calc.js) over the regression case grid. Useful to describe the effect of fixes.
// Usage: node tools/legacy/compare.mjs [count]
import { runLegacy } from './run-legacy.mjs';
import { calculate } from '../../js/engine.js';
import { fixtureData } from '../../tests/helpers/data.mjs';
import { generateCases, BASE_INPUT } from '../../tests/helpers/cases.mjs';

const FIELDS = ['grundavdrag', 'statligSkatt', 'jobbskatteavdrag', 'skattereduktionForvarvsinkomst',
  'incomeTax', 'netSalaryYear', 'grossSalaryMonth', 'totalTax', 'netSumMonth'];
const count = Number(process.argv[2] ?? 400);
const stats = {};
const cases = [BASE_INPUT, ...generateCases(count)];
for (const input of cases) {
  const { result: old } = await runLegacy(input);
  const now = calculate(input, fixtureData);
  for (const k of FIELDS) {
    const d = now[k] - old[k];
    if (!Number.isFinite(d) || Math.abs(d) < 0.5) continue;
    const s = (stats[`${k} ${input.year}`] ??= { n: 0, min: Infinity, max: -Infinity });
    s.n++; s.min = Math.min(s.min, d); s.max = Math.max(s.max, d);
  }
}
console.log(`${cases.length} cases. Differences (new - old), per field and year:`);
for (const [k, s] of Object.entries(stats).sort()) {
  console.log(`${k.padEnd(38)} ${String(s.n).padStart(4)} cases   ${Math.round(s.min)} .. ${Math.round(s.max)} kr`);
}
