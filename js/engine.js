// Calculation engine: pure, synchronous functions with no DOM or network access.
//
// calculate(inputs, data) runs the full chain
//   Privat skatt (salary) -> Bolag (resultat) -> Utdelning (3:12) -> Sammanfattning
// and returns one flat object with all intermediate values. A value that cannot be
// computed because inputs are missing is NaN.
//
// data.grundavdragTable(year, 'forhojt') must return Skatteverket's table of förhöjt
// grundavdrag for the year (only consulted for older people), see grundavdrag.js.

import { getYearParams, getInkomstbasbelopp, RATES, ARBETSGIVARAVGIFT } from './params.js';
import { grundavdrag, grundavdragGroup } from './grundavdrag.js';
import { businessDays } from './holidays.js';

// ---------------------------------------------------------------------------
// Uppdrag
// ---------------------------------------------------------------------------

// Billable hours = 8 h * working rate * (business days in period - vacation days).
export function billableHours({ startDate, endDate, workingRatePercent, vacationDays }) {
  const days = Math.max(0, businessDays(startDate, endDate) - vacationDays);
  return Math.round(days * 8 * workingRatePercent * 0.01);
}

export function invoicedAmount({ hourlyRate, billableHours }) {
  return hourlyRate * billableHours;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

// Fields that are computed by the engine. All start as NaN.
const COMPUTED = [
  'grossSemesterersattning', 'grossSalaryYear', 'grundavdrag', 'kommunalSkatt', 'statligSkatt',
  'burialSkatt', 'churchSkatt', 'publicServiceSkatt', 'jobbskatteavdrag',
  'skattereduktionForvarvsinkomst', 'incomeTax', 'netSalaryYear', 'netSemesterersattning',
  'netSalaryMonth', 'incomeTaxPercentage', 'pension', 'insurance', 'slp', 'arbetsgivaravgift',
  'totalCost', 'profitBeforeTax', 'profitAfterTax', 'omkostnadsbeloppInterest',
  'salaryBasedLimit', 'grundbelopp', 'dividendsLimitForenklingsregeln',
  'dividendsLimitHuvudregeln', 'dividendsLimit', 'netDividends', 'profitAfterDividends',
  'netSumMonth', 'totalTax', 'bolagsTaxExclDividends', 'totalTaxPercentage',
  'personIncomeTax', 'otherIncomeTax', 'otherNetYear',
];

// inputs:
//   year, yearBorn,
//   kommunalSkattPercent, burialSkattPercent, churchMember, churchSkattPercent  (in %),
//   useMaxGrossSalary, grossSalaryMonth, salaryMonths, useSemesterersattning, vacationDays,
//   usePension, pensionPercent (default 4.7), otherCosts, otherRevenue, invoicedAmount,
//   maxDividend, grossDividends, savedDividends, omkostnadsbelopp
function initFields(inp) {
  const f = {
    year: inp.year,
    kommunalSkattPercent: 0.01 * inp.kommunalSkattPercent,
    churchSkattPercent: inp.churchMember ? 0.01 * inp.churchSkattPercent : 0,
    burialSkattPercent: 0.01 * inp.burialSkattPercent,
    age: inp.year - inp.yearBorn - 1,
    useMaxGrossSalary: inp.useMaxGrossSalary,
    grossSalaryMonth: inp.grossSalaryMonth,
    salaryMonths: inp.salaryMonths,
    useSemesterersattning: inp.useSemesterersattning,
    vacationDays: inp.vacationDays,
    usePension: inp.usePension,
    // Salary from other employers (gross per year), taxed together with the salary from the company.
    otherSalaryYear: Number.isFinite(inp.otherSalaryYear) ? inp.otherSalaryYear : 0,
    pensionRate: inp.pensionPercent === undefined || inp.pensionPercent === null ? RATES.pensionPremium : inp.pensionPercent / 100,
    pensionMode: inp.pensionMode === 'amount' ? 'amount' : 'percent',
    pensionAmount: inp.pensionAmount ?? 0,
    otherCosts: inp.otherCosts,
    otherRevenue: inp.otherRevenue,
    invoicedAmount: inp.invoicedAmount,
    maxDividend: inp.maxDividend,
    grossDividends: inp.grossDividends,
    savedDividends: inp.savedDividends,
    omkostnadsbelopp: inp.omkostnadsbelopp,
  };
  for (const k of COMPUTED) f[k] = NaN;
  return f;
}

// ---------------------------------------------------------------------------
// Privat skatt (salary)
// ---------------------------------------------------------------------------

function salary(f, p, data) {
  if (isNaN(f.kommunalSkattPercent) || isNaN(f.churchSkattPercent) || isNaN(f.burialSkattPercent) ||
      isNaN(f.age) || f.age < 0 || f.age > 150) {
    return;
  }
  f.vacationMonths = f.useSemesterersattning ? RATES.semesterersattningPerDay * f.vacationDays : 0;
  const monthMultiplier = f.vacationMonths + f.salaryMonths;
  const other = f.otherSalaryYear ?? 0;
  if (f.useMaxGrossSalary && monthMultiplier > 0) {
    // All salaries together up to the brytpunkt.
    const brytpunkt = getBrytpunkt(f.year, grundavdragGroup(f.age, p.forhojtGrundavdragAge), data);
    f.grossSalaryMonth = Math.floor(Math.max(0, brytpunkt - other) / monthMultiplier);
  }
  f.grossSemesterersattning = Math.floor(f.vacationMonths * f.grossSalaryMonth);
  f.grossSalaryYear = Math.floor(monthMultiplier * f.grossSalaryMonth);
  // Fastställd förvärvsinkomst (all salaries together) is rounded down to whole hundreds.
  f.grossSalaryYearRough = Math.floor((f.grossSalaryYear + other) / 100) * 100;

  incomeTax(f, p, data);
  if (isNaN(f.grundavdrag)) {
    return;
  }
  // The tax is on all salaries together. The other salary is charged the tax it would have
  // on its own; the salary from the company carries the rest (the extra tax it causes).
  f.personIncomeTax = f.incomeTax;
  f.otherIncomeTax = 0;
  if (other > 0) {
    const alone = { year: f.year, age: f.age, kommunalSkattPercent: f.kommunalSkattPercent, burialSkattPercent: f.burialSkattPercent,
      churchSkattPercent: f.churchSkattPercent, grossSalaryYearRough: Math.floor(other / 100) * 100 };
    incomeTax(alone, p, data);
    f.otherIncomeTax = alone.incomeTax;
    f.incomeTax = f.personIncomeTax - f.otherIncomeTax;
  }
  f.otherNetYear = other - f.otherIncomeTax;
  f.netSalaryYear = f.grossSalaryYear - f.incomeTax;
  f.netSalaryMonth = monthMultiplier > 0 ? f.netSalaryYear / monthMultiplier : 0;
  f.netSemesterersattning = f.vacationMonths * f.netSalaryMonth;
  f.incomeTaxPercentage = 100 * f.personIncomeTax / (f.grossSalaryYear + other);
}

// Slutlig skatt on income from employment. Needs f.year, f.age, the tax rates (as
// fractions) and f.grossSalaryYearRough (fastställd förvärvsinkomst). Sets f.grundavdrag,
// f.taxableIncome, each tax component, the tax reductions and f.incomeTax.
//
// The tax reductions can only reduce kommunal and statlig inkomstskatt, in this order:
// allmän pensionsavgift, arbetsinkomster (jobbskatteavdrag, at most the kommunal skatt
// left after the first reduction), förvärvsinkomst, and in 2021-2022 the tillfällig
// skattereduktion för arbetsinkomster. Begravningsavgift, kyrkoavgift,
// public service-avgift and the allmän pensionsavgift itself are never reduced.
function incomeTax(f, p, data) {
  const group = grundavdragGroup(f.age, p.forhojtGrundavdragAge);
  f.grundavdrag = grundavdrag({
    group,
    income: f.grossSalaryYearRough,
    pbb: p.prisbasbelopp,
    table: group === 'forhojt' ? data.grundavdragTable(f.year, group) : null,
  });
  if (isNaN(f.grundavdrag)) {
    return;
  }
  f.taxableIncome = f.grossSalaryYearRough - f.grundavdrag;
  f.kommunalSkatt = Math.floor(f.kommunalSkattPercent * f.taxableIncome);
  f.statligSkatt = Math.floor(RATES.statligSkatt * Math.max(0, f.taxableIncome - p.skiktgrans));
  f.burialSkatt = Math.floor(f.burialSkattPercent * f.taxableIncome);
  f.churchSkatt = Math.floor(f.churchSkattPercent * f.taxableIncome);
  f.publicServiceSkatt = Math.min(p.publicServiceMax, Math.floor(RATES.publicServiceRate * f.taxableIncome));

  f.currentIBB = getInkomstbasbelopp(f.year);
  f.prevIBB = getInkomstbasbelopp(f.year - 1) || f.currentIBB;
  f.allmanPensionsAvgift = allmanPensionsavgift(f.grossSalaryYearRough, p, f.currentIBB);

  const reducible = f.kommunalSkatt + f.statligSkatt;
  f.skattereduktionAllmanPensionsavgift = Math.min(f.allmanPensionsAvgift, reducible);
  f.jobbskatteavdrag = Math.max(0, Math.min(jobbskatteavdrag(f, p), f.kommunalSkatt - f.skattereduktionAllmanPensionsavgift));
  f.skattereduktionForvarvsinkomst = p.skattereduktionForvarvsinkomst
    ? Math.max(0, Math.min(skattereduktionForvarvsinkomst(f.taxableIncome),
      reducible - f.skattereduktionAllmanPensionsavgift - f.jobbskatteavdrag))
    : 0;
  f.tillfalligSkattereduktion = p.tillfalligSkattereduktionArbetsinkomster
    ? Math.max(0, Math.min(tillfalligSkattereduktion(f.grossSalaryYearRough),
      reducible - f.skattereduktionAllmanPensionsavgift - f.jobbskatteavdrag - f.skattereduktionForvarvsinkomst))
    : 0;
  f.incomeTax = f.kommunalSkatt + f.statligSkatt + f.burialSkatt + f.churchSkatt + f.publicServiceSkatt +
    f.allmanPensionsAvgift - f.skattereduktionAllmanPensionsavgift - f.jobbskatteavdrag -
    f.skattereduktionForvarvsinkomst - f.tillfalligSkattereduktion;
}

// Lag (2021:930) om tillfällig skattereduktion för arbetsinkomster, 4 §.
function tillfalligSkattereduktion(income) {
  if (income <= 60000 || income >= 500000) return 0;
  if (income < 240000) return Math.floor(0.0125 * (income - 60000));
  if (income <= 300000) return 2250;
  return Math.floor(2250 - 0.01125 * (income - 300000));
}

// Allmän pensionsavgift: 7 % of income up to 8.07 inkomstbasbelopp, nothing if income is
// below 42.3 % of prisbasbelopp. Rounded to the nearest hundred, 50 rounded down.
// https://www4.skatteverket.se/rattsligvagledning/edition/2024.7/1348.html
function allmanPensionsavgift(income, p, ibb) {
  if (income < RATES.allmanPensionsavgiftFloorPbb * p.prisbasbelopp) {
    return 0;
  }
  const avgift = RATES.allmanPensionsavgift * Math.min(income, RATES.allmanPensionsavgiftCapIbb * ibb);
  return Math.ceil(Math.floor(avgift) / 100 - 0.5) * 100 + 0; // + 0 turns -0 into 0
}

// Brytpunkt: the highest yearly income (whole hundreds) on which no statlig inkomstskatt is
// paid, i.e. where beskattningsbar förvärvsinkomst reaches the skiktgräns.
const brytpunktCache = new Map();
export function getBrytpunkt(year, group, data) {
  const key = `${year}-${group}`;
  if (brytpunktCache.has(key)) return brytpunktCache.get(key);
  const p = getYearParams(year);
  const table = group === 'forhojt' ? data.grundavdragTable(year, group) : null;
  const taxable = (income) => income - grundavdrag({ group, income, pbb: p.prisbasbelopp, table });
  let income = p.skiktgrans;
  while (taxable(income + 100) <= p.skiktgrans) income += 100;
  if (!isNaN(taxable(income))) brytpunktCache.set(key, income);
  return isNaN(taxable(income)) ? NaN : income;
}

// Private income tax for a given annual income from employment, e.g. to compare with
// Skatteverket's calculator. Rates in percent.
export function privateIncomeTax({ year, yearBorn, income, kommunalSkattPercent, burialSkattPercent, churchSkattPercent = 0 }, data) {
  const p = getYearParams(year);
  const f = {
    year,
    age: year - yearBorn - 1,
    kommunalSkattPercent: 0.01 * kommunalSkattPercent,
    burialSkattPercent: 0.01 * burialSkattPercent,
    churchSkattPercent: 0.01 * churchSkattPercent,
    grossSalaryYearRough: Math.floor(income / 100) * 100,
    incomeTax: NaN,
  };
  incomeTax(f, p, data);
  return f;
}

function skattereduktionForvarvsinkomst(taxableIncome) {
  const { threshold, rate, max } = RATES.skattereduktionForvarvsinkomst;
  if (taxableIncome <= threshold) {
    return 0;
  }
  return Math.floor(Math.min(max, rate * (taxableIncome - threshold)));
}

// https://www4.skatteverket.se/rattsligvagledning/edition/2024.7/2940.html
function jobbskatteavdrag(f, p) {
  const pbb = p.prisbasbelopp;
  const k = p.jobbskatteavdrag;
  const income = f.grossSalaryYearRough;
  const ratio = income / pbb;
  if (f.age < k[8]) {
    if (ratio < 0.91) {
      return Math.floor((income - f.grundavdrag) * f.kommunalSkattPercent);
    }
    if (ratio < 3.24) {
      return Math.floor(((0.91 * pbb + k[0] * (income - 0.91 * pbb)) - f.grundavdrag) * f.kommunalSkattPercent);
    }
    if (ratio < 8.08) {
      return Math.floor(((k[1] * pbb + k[2] * (income - 3.24 * pbb)) - f.grundavdrag) * f.kommunalSkattPercent);
    }
    if (ratio < 13.54) {
      return Math.floor((k[3] * pbb - f.grundavdrag) * f.kommunalSkattPercent);
    }
    return Math.floor((k[3] * pbb - f.grundavdrag) * f.kommunalSkattPercent - k[7] * (income - 13.54 * pbb));
  }
  // Jobbskatteavdrag för äldre
  if (f.year >= 2024) {
    if (ratio <= 1.75) {
      return Math.floor(0.22 * income);
    }
    if (ratio <= 5.24) {
      return Math.floor((0.2635 * pbb) + (0.07 * income));
    }
    if (ratio <= 10.48) {
      return Math.floor(0.6293 * pbb);
    }
    return Math.floor(Math.max(0, (0.6293 * pbb) - k[7] * (income - 10.48 * pbb)));
  }
  if (income <= 100000) {
    return Math.floor(k[4] * income);
  }
  if (income <= 300000) {
    return Math.floor(15000 + k[5] * income);
  }
  if (income <= 600000) {
    return Math.floor(k[6]);
  }
  return Math.floor(Math.max(0, k[6] - 0.03 * (income - 600000)));
}

// ---------------------------------------------------------------------------
// Bolag (resultat)
// ---------------------------------------------------------------------------

// Arbetsgivaravgift for a salary, by the employee's birth year (see ARBETSGIVARAVGIFT in
// params.js). Temporary reductions apply to the part of the monthly salary up to the cap,
// for the months they cover; salary months are assumed to be spread evenly over the year
// and semesterersättning is charged at the normal rate.
export function arbetsgivaravgift({ year, yearBorn, grossSalaryYear, grossSalaryMonth, salaryMonths }) {
  const rules = ARBETSGIVARAVGIFT[year];
  const band = rules.bands.find((b) => yearBorn <= b.bornTo);
  let avgift = band.rate * grossSalaryYear;
  for (const r of rules.reductions) {
    const applies = r.bornFrom === null || (yearBorn >= r.bornFrom && yearBorn <= r.bornTo);
    if (!applies || r.rate >= band.rate) continue;
    const reducedMonths = salaryMonths * r.months.length / 12;
    avgift -= reducedMonths * Math.min(grossSalaryMonth, r.capMonth) * (band.rate - r.rate);
  }
  return avgift;
}

// Pension cost the company may deduct (inkomstskattelagen 28 kap. 5 §): at most 35 % of the
// salary and at most 10 prisbasbelopp per employee.
export function pensionDeductionCap(salary, prisbasbelopp) {
  return Math.min(0.35 * salary, 10 * prisbasbelopp);
}

// What one employee costs the company besides the salary: pension (with the deductible
// part), arbetsskadeförsäkring, särskild löneskatt and arbetsgivaravgift.
function employment(f, p, employed = true) {
  if (!f.usePension) f.pension = 0;
  else if (f.pensionMode === 'amount') f.pension = f.pensionAmount;
  else f.pension = f.pensionRate * f.grossSalaryYear;
  f.pensionDeductible = Math.min(f.pension, pensionDeductionCap(f.grossSalaryYear, p.prisbasbelopp));
  f.pensionNonDeductible = f.pension - f.pensionDeductible;
  f.insurance = employed ? RATES.arbetsskadeforsakring : 0;
  f.slp = RATES.sarskildLoneskatt * (f.pension + f.insurance);
  f.arbetsgivaravgift = arbetsgivaravgift({
    year: f.year,
    yearBorn: f.year - f.age - 1,
    grossSalaryYear: f.grossSalaryYear,
    grossSalaryMonth: f.grossSalaryMonth,
    salaryMonths: f.salaryMonths,
  });
}

function company(f, p) {
  if (isNaN(f.otherCosts) || isNaN(f.grossSalaryYear) || isNaN(f.otherRevenue) || isNaN(f.invoicedAmount)) {
    return;
  }
  employment(f, p);
  f.totalCost = f.otherCosts + f.grossSalaryYear + f.pension + f.insurance + f.slp + f.arbetsgivaravgift;
  f.profitBeforeTax = f.invoicedAmount + f.otherRevenue - f.totalCost;
  // Bolagsskatt on the taxable profit: the profit plus pension cost that may not be
  // deducted. A loss gives no tax back this year (it can only be carried forward).
  f.bolagsTax = Math.max(0, f.profitBeforeTax + f.pensionNonDeductible) * p.bolagsskatt;
  f.profitAfterTax = f.profitBeforeTax - f.bolagsTax;
}

// ---------------------------------------------------------------------------
// Utdelning (3:12)
// ---------------------------------------------------------------------------
// Assumptions: aktiebolag, fåmansföretag, you own 100 % of the shares, you are the only
// employee, no salary from other sources, no qualified shares in other companies.

// 3:12 gränsbelopp (utdelningsgräns) for one owner. Uses the previous year's
// inkomstbasbelopp. ownership: share of the company (0-1). totalSalary: all salaries paid by
// the company; ownSalary: the owner's own salary from the company.
export function dividendLimit({ year, ownSalary, totalSalary = ownSalary, ownership = 1, ownershipInOtherCompanies = 0, omkostnadsbelopp, savedDividends = 0 }) {
  const p = getYearParams(year);
  const prevIBB = getInkomstbasbelopp(year - 1) || getInkomstbasbelopp(year);
  const r = {
    salaryBasedLimit: NaN, forenklingsregeln: NaN, huvudregeln: NaN, grundbelopp: NaN,
    omkostnadsbeloppInterest: NaN, limit: NaN,
  };
  if (year <= 2025) {
    const canUseSalaryBase = ownSalary >= 9.60 * prevIBB || ownSalary >= (6 * prevIBB + 0.05 * totalSalary);
    r.salaryBasedLimit = ownership * 0.5 * totalSalary;
    r.forenklingsregeln = ownership * 2.75 * prevIBB;
    r.omkostnadsbeloppInterest = p.klyvningsranta * omkostnadsbelopp;
    r.huvudregeln = r.omkostnadsbeloppInterest + canUseSalaryBase * Math.min(r.salaryBasedLimit, 50 * ownSalary);
    r.limit = Math.floor(Math.max(r.forenklingsregeln, r.huvudregeln)) + savedDividends;
  } else {
    // New 3:12 rules from 2026:
    // https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/andradereglerinforinkomstdeklarationen2027.4.4a54dc8b19aa6175a152359.html
    const totalOwnership = ownership + ownershipInOtherCompanies;
    // Grundbelopp: 4 inkomstbasbelopp per company, split equally per share. One person gets
    // at most one grundbelopp in total; if their shares in all companies add up to more than
    // 100 %, each company's part is scaled down in proportion.
    r.grundbelopp = ownership * 4 * prevIBB / Math.max(1, totalOwnership);
    r.salaryBasedLimit = 0.5 * Math.min(Math.max(0, ownership * totalSalary - 8 * prevIBB), 50 * ownSalary);
    r.omkostnadsbeloppInterest = p.klyvningsranta * Math.max(0, omkostnadsbelopp - 100000);
    r.limit = Math.floor(r.omkostnadsbeloppInterest + r.grundbelopp + r.salaryBasedLimit) + savedDividends;
  }
  return r;
}

// Assumptions: aktiebolag, fåmansföretag, you own 100 % of the shares, you are the only
// employee, no salary from other sources, no qualified shares in other companies.
function dividends(f) {
  if (isNaN(f.grossSalaryYear) || isNaN(f.profitAfterTax) || isNaN(f.savedDividends) || isNaN(f.omkostnadsbelopp)) {
    return;
  }
  const d = dividendLimit({
    year: f.year,
    ownSalary: f.grossSalaryYear,
    omkostnadsbelopp: f.omkostnadsbelopp,
    savedDividends: f.savedDividends,
  });
  f.salaryBasedLimit = d.salaryBasedLimit;
  f.dividendsLimitForenklingsregeln = d.forenklingsregeln;
  f.dividendsLimitHuvudregeln = d.huvudregeln;
  f.grundbelopp = d.grundbelopp;
  f.omkostnadsbeloppInterest = d.omkostnadsbeloppInterest;
  f.dividendsLimit = d.limit;
  if (f.maxDividend) {
    f.grossDividends = Math.max(0, Math.min(f.dividendsLimit, f.profitAfterTax));
  } else if (f.grossDividends > f.dividendsLimit) {
    f.grossDividends = f.dividendsLimit;
  }
  f.netDividends = f.grossDividends * (1 - RATES.dividendTax);
  f.profitAfterDividends = f.profitAfterTax - f.grossDividends;
}

// ---------------------------------------------------------------------------
// Sammanfattning
// ---------------------------------------------------------------------------

function summary(f, p) {
  if (isNaN(f.incomeTax) || isNaN(f.slp) || isNaN(f.arbetsgivaravgift) || isNaN(f.grossDividends) ||
      isNaN(f.netSalaryMonth) || isNaN(f.netDividends) || isNaN(f.salaryMonths) ||
      isNaN(f.profitBeforeTax) || isNaN(f.otherRevenue) || isNaN(f.invoicedAmount)) {
    return;
  }
  const t = p.bolagsskatt;
  if (f.profitBeforeTax > 0) {
    // Bolagsskatt on the profit that was paid out as dividends.
    f.bolagsTaxOnDividends = f.grossDividends * t / (1 - t);
    // Bolagsskatt on the profit that stays in the company.
    f.bolagsTaxExclDividends = f.profitAfterDividends * t / (1 - t);
  } else {
    f.bolagsTaxOnDividends = 0;
    f.bolagsTaxExclDividends = 0;
  }
  f.dividendTax = RATES.dividendTax * f.grossDividends;
  f.totalTax = f.incomeTax + f.slp + f.arbetsgivaravgift + f.bolagsTaxOnDividends + f.dividendTax;
  // Dividends are spread over the months with regular salary (not semesterersättning),
  // or over 12 months if there is no salary.
  // Everything the person gets per month: salaries from the company and other employers,
  // and dividends.
  f.netSumMonth = (f.otherNetYear ?? 0) / 12 + (f.salaryMonths > 0
    ? f.netSalaryMonth + f.netDividends / f.salaryMonths
    : f.netDividends / 12);
  f.totalTaxPercentage = 100 * f.totalTax / (f.invoicedAmount + f.otherRevenue);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function run(f, p, data) {
  salary(f, p, data);
  company(f, p);
  dividends(f);
  summary(f, p);
  return f;
}

export function calculate(inputs, data) {
  const p = getYearParams(inputs.year);
  return run(initFields(inputs), p, data);
}

// ---------------------------------------------------------------------------
// A company with several people (owners and/or employees)
// ---------------------------------------------------------------------------
//
// calculateCompany({ year, company, people }, data)
//   company: { invoicedAmount, otherRevenue, otherCosts, maxDividend, grossDividends (total) }
//   people:  [{ id, yearBorn, kommunalSkattPercent, burialSkattPercent, churchMember,
//               churchSkattPercent, ownershipPercent (0-100), employed, useMaxGrossSalary,
//               grossSalaryMonth, salaryMonths, useSemesterersattning, vacationDays, usePension,
//               pensionPercent, pensionMode, pensionAmount, omkostnadsbelopp, savedDividends,
//               otherSalaryYear }]
// Returns { company: {...}, people: [one object per person, with the same field names as
// calculate() for that person's salary, employment costs, 3:12 limit and dividend] }.
//
// Dividends are paid per share. "Maximal utdelning" is the largest total where no owner
// goes above their own gränsbelopp (so everything is taxed at 20 %), and at most the
// profit after tax. A manual total is capped the same way. Ownership must add up to 100 %;
// otherwise no dividend is calculated (company.ownershipSum says by how much it is off).
export function calculateCompany({ year, company: c, people }, data) {
  const p = getYearParams(year);
  const co = {
    year,
    invoicedAmount: c.invoicedAmount, otherRevenue: c.otherRevenue, otherCosts: c.otherCosts,
    maxDividend: c.maxDividend,
    grossSalaryYear: NaN, pension: NaN, insurance: NaN, slp: NaN, arbetsgivaravgift: NaN,
    totalCost: NaN, profitBeforeTax: NaN, bolagsTax: NaN, profitAfterTax: NaN,
    ownershipSum: NaN, otherOwnersShare: NaN, otherOwnersDividends: NaN, dividendCap: NaN, limitingOwner: null, grossDividends: NaN,
    netDividends: NaN, profitAfterDividends: NaN, incomeTax: NaN, netSalaryYear: NaN, dividendTax: NaN,
    bolagsTaxOnDividends: NaN, bolagsTaxExclDividends: NaN, totalTax: NaN, totalTaxPercentage: NaN,
  };
  const ps = people.map((person) => {
    const employed = person.employed !== false;
    const f = initFields({
      ...person,
      year,
      ...(employed ? {} : { useMaxGrossSalary: false, grossSalaryMonth: 0, salaryMonths: 0, useSemesterersattning: false, usePension: false }),
    });
    f.id = person.id;
    f.employed = employed;
    f.ownership = Number.isFinite(person.ownershipPercent) ? person.ownershipPercent / 100 : NaN;
    salary(f, p, data);
    if (!isNaN(f.grossSalaryYear)) employment(f, p, employed);
    return f;
  });
  const sum = (key) => ps.reduce((acc, f) => acc + f[key], 0);
  co.ownershipSum = sum('ownership');
  // Shares not held by anyone in the calculation belong to other owners. They get their
  // dividend per share too, but their own 3:12 limits and taxes are not known here.
  co.otherOwnersShare = co.ownershipSum < 1 - 1e-9 ? 1 - co.ownershipSum : 0;

  if (!isNaN(co.otherCosts) && !isNaN(co.otherRevenue) && !isNaN(co.invoicedAmount) && ps.every((f) => !isNaN(f.arbetsgivaravgift))) {
    for (const k of ['grossSalaryYear', 'pension', 'insurance', 'slp', 'arbetsgivaravgift']) co[k] = sum(k);
    co.totalCost = co.otherCosts + co.grossSalaryYear + co.pension + co.insurance + co.slp + co.arbetsgivaravgift;
    co.profitBeforeTax = co.invoicedAmount + co.otherRevenue - co.totalCost;
    co.bolagsTax = Math.max(0, co.profitBeforeTax + sum('pensionNonDeductible')) * p.bolagsskatt;
    co.profitAfterTax = co.profitBeforeTax - co.bolagsTax;
  }

  // 3:12 per owner, then the total dividend. Needs at least one owner in the calculation
  // and shares of at most 100 % together.
  const owners = ps.filter((f) => f.ownership > 0);
  const ownersReady = !isNaN(co.profitAfterTax) && owners.length > 0 && co.ownershipSum <= 1 + 1e-9 &&
    ps.every((f) => !(f.ownership < 0 || f.ownership > 1)) &&
    owners.every((f) => !isNaN(f.omkostnadsbelopp) && !isNaN(f.savedDividends));
  if (ownersReady) {
    co.dividendCap = Infinity;
    for (const f of owners) {
      const d = dividendLimit({
        year, ownSalary: f.grossSalaryYear, totalSalary: co.grossSalaryYear, ownership: f.ownership,
        omkostnadsbelopp: f.omkostnadsbelopp, savedDividends: f.savedDividends,
      });
      f.salaryBasedLimit = d.salaryBasedLimit;
      f.dividendsLimitForenklingsregeln = d.forenklingsregeln;
      f.dividendsLimitHuvudregeln = d.huvudregeln;
      f.grundbelopp = d.grundbelopp;
      f.omkostnadsbeloppInterest = d.omkostnadsbeloppInterest;
      f.dividendsLimit = d.limit;
      const cap = d.limit / f.ownership;
      if (cap < co.dividendCap) {
        co.dividendCap = cap;
        co.limitingOwner = f.id;
      }
    }
    co.grossDividends = c.maxDividend
      ? Math.max(0, Math.min(co.dividendCap, co.profitAfterTax))
      : Math.min(c.grossDividends, co.dividendCap);
    co.profitAfterDividends = co.profitAfterTax - co.grossDividends;
    co.otherOwnersDividends = co.grossDividends * co.otherOwnersShare;
  }
  for (const f of ps) {
    if (!ownersReady) break;
    f.grossDividends = f.ownership > 0 ? co.grossDividends * f.ownership : 0;
    f.netDividends = f.grossDividends * (1 - RATES.dividendTax);
    f.limitsDividend = f.id === co.limitingOwner;
  }

  // Summary per person and for the company.
  if (ownersReady && ps.every((f) => !isNaN(f.incomeTax))) {
    const t = p.bolagsskatt;
    const taxed = co.profitBeforeTax > 0;
    co.bolagsTaxOnDividends = taxed ? co.grossDividends * t / (1 - t) : 0;
    co.bolagsTaxExclDividends = taxed ? co.profitAfterDividends * t / (1 - t) : 0;
    co.netDividends = sum('netDividends');
    co.incomeTax = sum('incomeTax');
    co.netSalaryYear = sum('netSalaryYear');
    // Dividend tax for the people in the calculation (other owners' tax is not known).
    co.dividendTax = RATES.dividendTax * (co.grossDividends - co.otherOwnersDividends);
    co.totalTax = co.incomeTax + co.slp + co.arbetsgivaravgift + co.bolagsTaxOnDividends + co.dividendTax;
    co.totalTaxPercentage = 100 * co.totalTax / (co.invoicedAmount + co.otherRevenue);
    for (const f of ps) {
      f.bolagsTaxOnDividends = taxed ? f.grossDividends * t / (1 - t) : 0;
      f.dividendTax = RATES.dividendTax * f.grossDividends;
      f.totalTax = f.incomeTax + f.slp + f.arbetsgivaravgift + f.bolagsTaxOnDividends + f.dividendTax;
      f.netSumMonth = f.otherNetYear / 12 + (f.salaryMonths > 0
        ? f.netSalaryMonth + f.netDividends / f.salaryMonths
        : f.netDividends / 12);
    }
  }
  return { company: co, people: ps };
}

// The salary sweep for one person in a company with several people: everything else fixed.
export function companySalarySweep(inputs, index, data, step = 500) {
  const c = inputs.company;
  const person = inputs.people[index];
  if (!person || person.employed === false) return null;
  const at = (gross) => {
    const people = inputs.people.map((x, i) => (i === index ? { ...x, grossSalaryMonth: gross, useMaxGrossSalary: false } : x));
    const r = calculateCompany({ ...inputs, people }, data);
    return {
      // Everyone in the company, so that the parts add up to the same total at every salary.
      grossSalaryMonth: gross, netSalaryYear: r.company.netSalaryYear, netDividends: r.company.netDividends, pension: r.company.pension,
      otherOwnersDividends: r.company.otherOwnersDividends,
      grossSalaryYear: r.company.grossSalaryYear, grossDividends: r.company.grossDividends,
      profitAfterDividends: r.company.profitAfterDividends, bolagsTaxExclDividends: r.company.bolagsTaxExclDividends,
      totalTax: r.company.totalTax, totalTaxPercentage: r.company.totalTaxPercentage,
    };
  };
  if (isNaN(at(person.grossSalaryMonth).totalTaxPercentage)) return null;
  const pensionRate = person.usePension ? (person.pensionPercent ?? 100 * RATES.pensionPremium) / 100 : RATES.pensionPremium;
  const totalRevenue = c.invoicedAmount + c.otherRevenue - c.otherCosts;
  return sweep(at, totalRevenue, pensionRate, step);
}

// What a monthly salary costs the company per month (excluding the small flat
// arbetsskadeförsäkring): salary + arbetsgivaravgift + tjänstepension + särskild löneskatt.
export function employerCost({ grossSalaryMonth, usePension = true, pensionRate = RATES.pensionPremium }) {
  const arbetsgivaravgift = RATES.arbetsgivaravgift * grossSalaryMonth;
  const pension = usePension ? pensionRate * grossSalaryMonth : 0;
  const slp = RATES.sarskildLoneskatt * pension;
  return { arbetsgivaravgift, pension, slp, total: grossSalaryMonth + arbetsgivaravgift + pension + slp };
}

// The monthly gross salary an employee would need to get `targetNetMonth` after tax
// (12 equal months, no other income). person: { year, yearBorn, kommunalSkattPercent,
// burialSkattPercent, churchSkattPercent }. Returns the lowest whole-krona salary that
// reaches the target.
export function equivalentEmployeeSalary({ targetNetMonth, ...person }, data) {
  const netMonth = (grossMonth) => {
    const t = privateIncomeTax({ ...person, income: 12 * grossMonth }, data);
    return (12 * grossMonth - t.incomeTax) / 12;
  };
  if (!(targetNetMonth > 0) || isNaN(netMonth(0))) return { grossSalaryMonth: NaN, netSalaryMonth: NaN };
  let lo = 0;
  let hi = 10000;
  while (netMonth(hi) < targetNetMonth && hi < 1e8) hi *= 2;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (netMonth(mid) >= targetNetMonth) hi = mid;
    else lo = mid;
  }
  return { grossSalaryMonth: hi, netSalaryMonth: netMonth(hi) };
}

// Recalculates `result` for monthly gross salaries 0, 500, 1000, ... up to the point where
// the company would make a loss after dividends. Feeds the two line charts.
export function salarySweep(result, data, step = 500) {
  if (isNaN(result.totalTaxPercentage)) return null;
  const p = getYearParams(result.year);
  const totalRevenue = result.invoicedAmount + result.otherRevenue - result.otherCosts;
  const pensionRate = result.usePension ? result.pensionRate ?? RATES.pensionPremium : RATES.pensionPremium;
  return sweep((gross) => run({ ...result, grossSalaryMonth: gross, useMaxGrossSalary: false }, p, data), totalRevenue, pensionRate, step);
}

// at(grossSalaryMonth) returns the person's salary, dividend and pension and the totals.
function sweep(at, totalRevenue, pensionRate, step) {
  const out = {
    grossSalaryMonth: [], netSalaryYear: [], netDividends: [], pension: [], otherOwnersDividends: [],
    profitAfterDividends: [], totalTax: [], bolagsTaxExclDividends: [],
    taxPercentage: [], marginalTaxPercentage: [],
    maxSum: { x: 0, y: 0 }, minTax: { x: 0, y: 10000 },
  };
  const probableMaxGrossSalary = 10000 + totalRevenue / (1 + RATES.arbetsgivaravgift + pensionRate * (1 + RATES.sarskildLoneskatt));
  const count = Math.floor(probableMaxGrossSalary / step) + 1;

  let prevTotalTax = 0;
  let prevGrossSumYear = 0;
  let marginalDone = false;
  for (let i = 0; i < count; i++) {
    const gross = i * step;
    const f = at(gross);
    if (f.profitAfterDividends < 0) break;

    out.grossSalaryMonth.push(gross);
    out.netSalaryYear.push(round0(f.netSalaryYear));
    out.netDividends.push(round0(f.netDividends));
    out.pension.push(round0(f.pension));
    out.otherOwnersDividends.push(round0(f.otherOwnersDividends || 0));
    out.profitAfterDividends.push(round0(f.profitAfterDividends));
    out.totalTax.push(round0(f.totalTax));
    out.bolagsTaxExclDividends.push(round0(f.bolagsTaxExclDividends));

    // Note: the unrounded value is compared with the rounded best value so far.
    const netSumYear = f.netSalaryYear + f.netDividends;
    if (netSumYear > out.maxSum.y) {
      out.maxSum = { x: f.grossSalaryMonth, y: round0(netSumYear) };
    }
    const grossSumYear = f.grossSalaryYear + f.grossDividends;
    const taxPercentage = 100 * f.totalTax / grossSumYear;
    out.taxPercentage.push(round2(taxPercentage));
    if (taxPercentage < out.minTax.y) {
      out.minTax = { x: f.grossSalaryMonth, y: round2(taxPercentage) };
    }

    if (!marginalDone) {
      if (i === 0) {
        out.marginalTaxPercentage.push(0);
      } else {
        const totalDiff = grossSumYear - prevGrossSumYear;
        if (totalDiff <= 0) {
          marginalDone = true;
        } else {
          out.marginalTaxPercentage.push(round2(100 * (f.totalTax - prevTotalTax) / totalDiff));
        }
      }
    }
    prevTotalTax = f.totalTax;
    prevGrossSumYear = grossSumYear;
  }
  return out;
}

// Same rounding as Number.prototype.toFixed(), returned as numbers.
function round0(x) {
  return Number(x.toFixed());
}
function round2(x) {
  return Number(x.toFixed(2));
}
