// Grundavdrag (basic allowance) for fastställd förvärvsinkomst.
//
// Under 66: computed from the statutory formula (63 kap. 3 § inkomstskattelagen), which is
// verified against Skatteverket's published tables for every 100 kr of income, 2019-2026
// (tests/correctness/grundavdrag.test.mjs).
// From 66 (förhöjt grundavdrag, 63 kap. 3 a §): looked up in Skatteverket's table, stored
// in data/grundavdrag/<year>-from66.json.
//
// A table is a list of rows [incomeFrom, incomeTo (null = open ended), grundavdrag
// (null = equals the income)], sorted by income, as stored in data/grundavdrag/.

export const GRUNDAVDRAG_DATASETS = {
  under66: 'ebbd8d70-9b9c-4327-b2ce-a371ee66744c',
  from66: '43902bf8-cb34-4288-ab95-2080f8a878dc',
};

export function grundavdragGroup(age) {
  return age < 66 ? 'under66' : 'from66';
}

// income: fastställd förvärvsinkomst, rounded down to whole hundreds.
export function lookupGrundavdrag(rows, income) {
  const minIncome = rows[0][1];
  if (income <= minIncome) return income;
  const last = rows[rows.length - 1];
  if (income >= last[0]) return last[2];
  for (let i = 1; i < rows.length - 1; i++) {
    const [from, to, avdrag] = rows[i];
    if (income >= from && income <= to) return avdrag;
  }
  return NaN;
}

// Converts rows in the open-data API's format to the compact format above.
export function rowsFromApi(results) {
  return results.map((r) => [
    parseInt(r['ink from']),
    r['ink tom'] === '' ? null : parseInt(r['ink tom']),
    /^\d+$/.test(r['gr avdrag']) ? parseInt(r['gr avdrag']) : null,
  ]);
}

const ceil100 = (x) => Math.ceil(x / 100) * 100;

// 63 kap. 3 § IL. income: fastställd förvärvsinkomst (whole hundreds), pbb: prisbasbelopp.
export function grundavdragFormula(income, pbb) {
  let g;
  if (income <= 0.99 * pbb) g = 0.423 * pbb;
  else if (income <= 2.72 * pbb) g = 0.423 * pbb + 0.2 * (income - 0.99 * pbb);
  else if (income <= 3.11 * pbb) g = 0.77 * pbb;
  else if (income <= 7.88 * pbb) g = 0.77 * pbb - 0.1 * (income - 3.11 * pbb);
  else g = 0.293 * pbb;
  return Math.min(income, ceil100(g));
}

// Returns NaN if a needed table is not available.
export function grundavdrag({ year, age, income, pbb, table }) {
  if (grundavdragGroup(age) === 'under66') return grundavdragFormula(income, pbb);
  return table ? lookupGrundavdrag(table, income) : NaN;
}
