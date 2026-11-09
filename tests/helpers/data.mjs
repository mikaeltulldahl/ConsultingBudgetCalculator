// Engine data source backed by the files in data/.
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../../data/grundavdrag/', import.meta.url);
const tables = {};
for (const name of readdirSync(dir)) {
  const { year, group, rows } = JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
  tables[`${year}-${group}`] = rows;
}

export const fixtureData = {
  grundavdragTable: (year, group) => tables[`${year}-${group}`],
};

export const grundavdragTables = tables;
