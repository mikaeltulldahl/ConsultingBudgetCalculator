// Grundavdrag lookup in Skatteverket's published tables.
// A table is a list of rows [incomeFrom, incomeTo (null = open ended), grundavdrag
// (null = equals the income)], sorted by income, as stored in tests/fixtures/grundavdrag/.

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
