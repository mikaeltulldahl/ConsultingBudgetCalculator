// 3:12 gränsbelopp against Skatteverket's own worked examples (see
// docs/research-multi-company-multi-year.md, section 6) and the law text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dividendLimit } from '../../js/engine.js';

// Inkomstbasbelopp 2025 = 80 600 (the 2026 rules use the year before).
const IBB_2025 = 80600;

test('2026: grundbelopp, lönebaserat utrymme and ränta (Skatteverket: Valter)', () => {
  // 100 %, omkostnadsbelopp 25 000, sparat 750 000, löneunderlag 1 000 000 of which own 600 000.
  const d = dividendLimit({ year: 2026, ownSalary: 600000, totalSalary: 1000000, ownership: 1, omkostnadsbelopp: 25000, savedDividends: 750000 });
  assert.equal(d.grundbelopp, 4 * IBB_2025);
  assert.equal(d.salaryBasedLimit, 0.5 * (1000000 - 8 * IBB_2025));
  assert.equal(d.limit, 1250000);
});

test('2026: the 50 x salary cap applies to the lönebaserat utrymme, not to the base before the 50 %', () => {
  // Own salary 10 000, löneunderlag 3 000 000: 50 % of (3 000 000 - 644 800) = 1 177 600, capped at 50 x 10 000.
  const d = dividendLimit({ year: 2026, ownSalary: 10000, totalSalary: 3000000, ownership: 1, omkostnadsbelopp: 25000 });
  assert.equal(d.salaryBasedLimit, 500000);
});

test('2026: spouses in the same company share one 8 inkomstbasbelopp deduction (Skatteverket: Amy and Gedion)', () => {
  const amy = dividendLimit({ year: 2026, ownSalary: 500000, totalSalary: 4000000, ownership: 0.6, spouseOwnership: 0.4, spouseSalary: 300000, omkostnadsbelopp: 25000 });
  const gedion = dividendLimit({ year: 2026, ownSalary: 300000, totalSalary: 4000000, ownership: 0.4, spouseOwnership: 0.6, spouseSalary: 500000, omkostnadsbelopp: 25000 });
  assert.equal(amy.salaryBasedLimit, 1006560);
  assert.equal(gedion.salaryBasedLimit, 671040);
  // Without the spouse link they would each get their own deduction.
  const unrelated = dividendLimit({ year: 2026, ownSalary: 500000, totalSalary: 4000000, ownership: 0.6, omkostnadsbelopp: 25000 });
  assert.equal(unrelated.salaryBasedLimit, 0.5 * (0.6 * 4000000 - 8 * IBB_2025));
});

test('2026: one grundbelopp per person across companies (Skatteverket: Tove)', () => {
  const g = (own, other) => dividendLimit({ year: 2026, ownSalary: 0, totalSalary: 0, ownership: own, ownershipInOtherCompanies: other, omkostnadsbelopp: 0 }).grundbelopp;
  assert.equal(g(0.25, 1.75), 40300);
  assert.equal(g(0.75, 1.25), 120900);
  assert.equal(g(1, 1), 161200);
});

test('up to 2025: sparat utdelningsutrymme is indexed (Skatteverket: Emma, income year 2025)', () => {
  // 100 %, omkostnadsbelopp 50 000, wages 600 000 (own), saved 125 700, indexed by 4,96 %.
  const d = dividendLimit({ year: 2025, ownSalary: 600000, totalSalary: 600000, ownership: 1, omkostnadsbelopp: 50000, savedDividends: 125700 });
  assert.equal(d.limit, 437414);
});

test('up to 2025: the lönebaserat utrymme needs a share of at least 4 % (SKV 292)', () => {
  const lowShare = dividendLimit({ year: 2025, ownSalary: 900000, totalSalary: 900000, ownership: 0.03, omkostnadsbelopp: 25000 });
  const enough = dividendLimit({ year: 2025, ownSalary: 900000, totalSalary: 900000, ownership: 0.04, omkostnadsbelopp: 25000 });
  assert.equal(lowShare.huvudregeln, lowShare.omkostnadsbeloppInterest);
  assert.ok(enough.huvudregeln > enough.omkostnadsbeloppInterest);
});

test('the salary test uses the higher of the owner\'s and the spouse\'s salary', () => {
  const alone = dividendLimit({ year: 2025, ownSalary: 100000, totalSalary: 900000, ownership: 0.5, omkostnadsbelopp: 25000 });
  const withSpouse = dividendLimit({ year: 2025, ownSalary: 100000, spouseSalary: 800000, totalSalary: 900000, ownership: 0.5, omkostnadsbelopp: 25000 });
  assert.equal(alone.huvudregeln, alone.omkostnadsbeloppInterest, 'salary too low');
  assert.ok(withSpouse.huvudregeln > withSpouse.omkostnadsbeloppInterest);
});
