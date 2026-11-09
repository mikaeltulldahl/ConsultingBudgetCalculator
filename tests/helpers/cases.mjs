// Deterministic grid of calculator inputs covering years, ages, salaries and options.

// Small seeded PRNG (mulberry32) so the cases are the same on every run.
function prng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Real 2026 rates for a few kommuner: [kommunal + region, begravning, kyrkoavgift].
const KOMMUNER = [
  [30.55, 0.07, 1.18], // Stockholm
  [32.6, 0.258, 1.1],
  [35.15, 0.293, 1.5],
  [29.18, 0.07, 0.9],
];

export const BASE_INPUT = {
  year: 2026,
  yearBorn: 1985,
  kommunalSkattPercent: 30.55,
  burialSkattPercent: 0.07,
  churchMember: false,
  churchSkattPercent: 1.18,
  useMaxGrossSalary: false,
  grossSalaryMonth: 55000,
  salaryMonths: 12,
  useSemesterersattning: true,
  vacationDays: 25,
  usePension: true,
  otherCosts: 20000,
  otherRevenue: 0,
  invoicedAmount: 1239000,
  maxDividend: true,
  grossDividends: 0,
  savedDividends: 0,
  omkostnadsbelopp: 25000,
};

export function generateCases(count, seed = 1) {
  const rnd = prng(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const cases = [];
  for (let i = 0; i < count; i++) {
    const year = 2020 + Math.floor(rnd() * 7);
    const age = pick([25, 40, 55, 64, 65, 66, 67, 72]);
    const [k, b, c] = pick(KOMMUNER);
    cases.push({
      year,
      yearBorn: year - age - 1,
      kommunalSkattPercent: k,
      burialSkattPercent: b,
      churchMember: rnd() < 0.3,
      churchSkattPercent: c,
      useMaxGrossSalary: rnd() < 0.2,
      grossSalaryMonth: pick([0, 5000, 15000, 25000, 35000, 45000, 55000, 65000, 80000, 100000, 150000])
        + Math.floor(rnd() * 10) * 137,
      salaryMonths: pick([12, 12, 12, 11, 6, 1]),
      useSemesterersattning: rnd() < 0.7,
      vacationDays: pick([0, 25, 30]),
      usePension: rnd() < 0.7,
      otherCosts: pick([0, 20000, 100000]),
      otherRevenue: pick([0, 0, 50000]),
      invoicedAmount: pick([0, 300000, 800000, 1239000, 1600000, 2500000]),
      maxDividend: rnd() < 0.7,
      grossDividends: pick([0, 100000, 300000, 900000]),
      savedDividends: pick([0, 0, 200000]),
      omkostnadsbelopp: pick([25000, 25000, 100000, 500000]),
    });
  }
  return cases;
}
