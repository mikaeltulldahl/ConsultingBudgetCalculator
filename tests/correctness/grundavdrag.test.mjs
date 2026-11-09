// The statutory grundavdrag formula must reproduce Skatteverket's published table exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grundavdragFormula, lookupGrundavdrag } from '../../js/grundavdrag.js';
import { YEARS } from '../../js/params.js';
import { grundavdragTables } from '../helpers/data.mjs';

const PBB = { 2019: 46500 };
for (const [y, p] of Object.entries(YEARS)) PBB[y] = p.prisbasbelopp;

for (const [year, pbb] of Object.entries(PBB)) {
  const table = grundavdragTables[`${year}-under66`];
  test(`grundavdrag formula equals Skatteverket table, ${year} under 66`, { skip: !table && 'no table' }, () => {
    const max = table[table.length - 1][0] + 50000;
    for (let income = 0; income <= max; income += 100) {
      assert.equal(grundavdragFormula(income, pbb), lookupGrundavdrag(table, income), `income ${income}`);
    }
  });
}

test('every year in params has both grundavdrag tables', () => {
  for (const year of Object.keys(YEARS)) {
    assert.ok(grundavdragTables[`${year}-under66`], `${year} under66`);
    assert.ok(grundavdragTables[`${year}-from66`], `${year} from66`);
  }
});
