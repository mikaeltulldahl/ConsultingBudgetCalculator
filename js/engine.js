// Calculation engine: pure, synchronous functions with no DOM or network access.
//
// calculate(inputs, data) runs the full chain
//   Privat skatt (salary) -> Bolag (resultat) -> Utdelning (3:12) -> Sammanfattning
// and returns one flat object with all intermediate values. A value that cannot be
// computed because inputs are missing is NaN.
//
// data.grundavdragTable(year, 'from66') must return Skatteverket's table of förhöjt
// grundavdrag for the year (only consulted for people aged 66 or older), see grundavdrag.js.

import { getYearParams, getInkomstbasbelopp, RATES } from './params.js';
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
];

// inputs:
//   year, yearBorn,
//   kommunalSkattPercent, burialSkattPercent, churchMember, churchSkattPercent  (in %),
//   useMaxGrossSalary, grossSalaryMonth, salaryMonths, useSemesterersattning, vacationDays,
//   usePension, otherCosts, otherRevenue, invoicedAmount,
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
  if (f.useMaxGrossSalary) {
    const brytpunkt = f.age >= 66 ? p.brytpunkt.from66 : p.brytpunkt.under66;
    f.grossSalaryMonth = Math.floor(brytpunkt / monthMultiplier);
  }
  f.grossSemesterersattning = Math.floor(f.vacationMonths * f.grossSalaryMonth);
  f.grossSalaryYear = Math.floor(monthMultiplier * f.grossSalaryMonth);
  // Fastställd förvärvsinkomst is rounded down to whole hundreds.
  f.grossSalaryYearRough = Math.floor(f.grossSalaryYear / 100) * 100;

  incomeTax(f, p, data);
  if (isNaN(f.grundavdrag)) {
    return;
  }
  f.netSalaryYear = f.grossSalaryYear - f.incomeTax;
  f.netSalaryMonth = f.netSalaryYear / monthMultiplier;
  f.netSemesterersattning = f.vacationMonths * f.netSalaryMonth;
  f.incomeTaxPercentage = 100 * f.incomeTax / f.grossSalaryYear;
}

// Slutlig skatt on income from employment. Needs f.year, f.age, the tax rates (as
// fractions) and f.grossSalaryYearRough (fastställd förvärvsinkomst). Sets f.grundavdrag,
// f.taxableIncome, each tax component, the tax reductions and f.incomeTax.
function incomeTax(f, p, data) {
  const group = grundavdragGroup(f.age);
  f.grundavdrag = grundavdrag({
    year: f.year,
    age: f.age,
    income: f.grossSalaryYearRough,
    pbb: p.prisbasbelopp,
    table: group === 'from66' ? data.grundavdragTable(f.year, group) : null,
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
  // https://www4.skatteverket.se/rattsligvagledning/edition/2024.7/1348.html
  if (f.grossSalaryYearRough < RATES.allmanPensionsavgiftFloorPbb * p.prisbasbelopp) {
    f.allmanPensionsAvgift = 0;
  } else {
    f.allmanPensionsAvgift = RATES.allmanPensionsavgift * Math.min(f.grossSalaryYearRough, RATES.allmanPensionsavgiftCapIbb * f.currentIBB);
    f.allmanPensionsAvgift = Math.floor(f.allmanPensionsAvgift / 100) * 100;
  }
  const skattereduktionAllmanPensionsAvgift = f.allmanPensionsAvgift;
  f.jobbskatteavdrag = Math.min(jobbskatteavdrag(f, p), f.kommunalSkatt - skattereduktionAllmanPensionsAvgift);
  f.skattereduktionForvarvsinkomst = skattereduktionForvarvsinkomst(f.taxableIncome);
  f.incomeTax = f.kommunalSkatt + f.statligSkatt + f.burialSkatt + f.churchSkatt + f.publicServiceSkatt -
    f.jobbskatteavdrag - f.skattereduktionForvarvsinkomst;
  if (f.incomeTax < 0) {
    f.jobbskatteavdrag += f.incomeTax;
    f.incomeTax = 0;
  }
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

function company(f) {
  if (isNaN(f.otherCosts) || isNaN(f.grossSalaryYear) || isNaN(f.otherRevenue) || isNaN(f.invoicedAmount)) {
    return;
  }
  f.pension = f.usePension ? RATES.pensionPremium * f.grossSalaryYear : 0;
  f.insurance = RATES.arbetsskadeforsakring;
  f.slp = RATES.sarskildLoneskatt * (f.pension + f.insurance);
  f.arbetsgivaravgift = RATES.arbetsgivaravgift * f.grossSalaryYear;
  f.totalCost = f.otherCosts + f.grossSalaryYear + f.pension + f.insurance + f.slp + f.arbetsgivaravgift;
  f.profitBeforeTax = f.invoicedAmount + f.otherRevenue - f.totalCost;
  f.profitAfterTax = f.profitBeforeTax * (1 - RATES.bolagsskatt);
}

// ---------------------------------------------------------------------------
// Utdelning (3:12)
// ---------------------------------------------------------------------------
// Assumptions: aktiebolag, fåmansföretag, you own 100 % of the shares, you are the only
// employee, no salary from other sources, no qualified shares in other companies.

function dividends(f, p) {
  if (isNaN(f.grossSalaryYear) || isNaN(f.profitAfterTax) || isNaN(f.savedDividends) || isNaN(f.omkostnadsbelopp)) {
    return;
  }
  const stockOwnerPercentage = 1;
  const stockOwnerShipInOtherCompanies = 0;
  const totalStockOwnership = stockOwnerPercentage + stockOwnerShipInOtherCompanies;
  const totalSalary = f.grossSalaryYear; // all employees
  // The dividend rules are based on the previous year's inkomstbasbelopp.
  if (f.year <= 2025) {
    const canUseSalaryBase = f.grossSalaryYear >= 9.60 * f.prevIBB || f.grossSalaryYear >= (6 * f.prevIBB + 0.05 * totalSalary);
    f.salaryBasedLimit = stockOwnerPercentage * 0.5 * totalSalary;
    f.dividendsLimitForenklingsregeln = stockOwnerPercentage * 2.75 * f.prevIBB;
    f.omkostnadsbeloppInterest = p.klyvningsranta * f.omkostnadsbelopp;
    f.dividendsLimitHuvudregeln = f.omkostnadsbeloppInterest + canUseSalaryBase * Math.min(f.salaryBasedLimit, 50 * f.grossSalaryYear);
    f.dividendsLimit = Math.floor(Math.max(f.dividendsLimitForenklingsregeln, f.dividendsLimitHuvudregeln)) + f.savedDividends;
  } else {
    // New 3:12 rules from 2026:
    // https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/andradereglerinforinkomstdeklarationen2027.4.4a54dc8b19aa6175a152359.html
    // https://youtu.be/m6xlQ2f1EEk
    f.dividendsLimitForenklingsregeln = NaN; // not applicable anymore
    f.dividendsLimitHuvudregeln = NaN; // not applicable anymore
    f.grundbelopp = stockOwnerPercentage / Math.min(1, totalStockOwnership) * 4 * f.prevIBB;
    f.salaryBasedLimit = 0.5 * Math.min(Math.max(0, stockOwnerPercentage * totalSalary - 8 * f.prevIBB), 50 * f.grossSalaryYear);
    f.omkostnadsbeloppInterest = p.klyvningsranta * Math.max(0, f.omkostnadsbelopp - 100000);
    f.dividendsLimit = Math.floor(f.omkostnadsbeloppInterest + f.grundbelopp + f.salaryBasedLimit) + f.savedDividends;
  }
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

function summary(f) {
  if (isNaN(f.incomeTax) || isNaN(f.slp) || isNaN(f.arbetsgivaravgift) || isNaN(f.grossDividends) ||
      isNaN(f.netSalaryMonth) || isNaN(f.netDividends) || isNaN(f.salaryMonths) ||
      isNaN(f.profitBeforeTax) || isNaN(f.otherRevenue) || isNaN(f.invoicedAmount)) {
    return;
  }
  const t = RATES.bolagsskatt;
  if (f.profitBeforeTax > 0) {
    f.bolagsTax = f.profitBeforeTax * t;
    // Bolagsskatt on the profit that was paid out as dividends.
    f.bolagsTaxOnDividends = f.grossDividends * t / (1 - t);
    // Bolagsskatt on the profit that stays in the company.
    f.bolagsTaxExclDividends = f.profitAfterDividends * t / (1 - t);
  } else {
    f.bolagsTax = 0;
    f.bolagsTaxOnDividends = 0;
    f.bolagsTaxExclDividends = 0;
  }
  f.dividendTax = RATES.dividendTax * f.grossDividends;
  f.totalTax = f.incomeTax + f.slp + f.arbetsgivaravgift + f.bolagsTaxOnDividends + f.dividendTax;
  // Dividends are spread over the months with regular salary (not semesterersättning).
  f.netSumMonth = f.netSalaryMonth + f.netDividends / f.salaryMonths;
  f.totalTaxPercentage = 100 * f.totalTax / (f.invoicedAmount + f.otherRevenue);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function run(f, p, data) {
  salary(f, p, data);
  company(f);
  dividends(f, p);
  summary(f);
  return f;
}

export function calculate(inputs, data) {
  const p = getYearParams(inputs.year);
  return run(initFields(inputs), p, data);
}

// Recalculates `result` for monthly gross salaries 0, 500, 1000, ... up to the point where
// the company would make a loss after dividends. Feeds the two line charts.
export function salarySweep(result, data, step = 500) {
  const p = getYearParams(result.year);
  const out = {
    grossSalaryMonth: [], netSalaryYear: [], netDividends: [], pension: [],
    profitAfterDividends: [], totalTax: [], bolagsTaxExclDividends: [],
    taxPercentage: [], marginalTaxPercentage: [],
    maxSum: { x: 0, y: 0 }, minTax: { x: 0, y: 10000 },
  };
  if (isNaN(result.totalTaxPercentage)) return null;

  const totalRevenue = result.invoicedAmount + result.otherRevenue - result.otherCosts;
  const probableMaxGrossSalary = 10000 + totalRevenue / (1 + RATES.arbetsgivaravgift + RATES.pensionPremium * (1 + RATES.sarskildLoneskatt));
  const count = Math.floor(probableMaxGrossSalary / step) + 1;

  let prevTotalTax = 0;
  let prevGrossSumYear = 0;
  let marginalDone = false;
  for (let i = 0; i < count; i++) {
    const gross = i * step;
    const f = run({ ...result, grossSalaryMonth: gross }, p, data);
    if (f.profitAfterDividends < 0) break;

    out.grossSalaryMonth.push(gross);
    out.netSalaryYear.push(round0(f.netSalaryYear));
    out.netDividends.push(round0(f.netDividends));
    out.pension.push(round0(f.pension));
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
