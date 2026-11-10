// Quick calculators: each one stands alone, with its own inputs, and uses the same engine
// functions as the structure. "Koppla in i min struktur" hands the inputs to the page.
import {
  privateIncomeTax, billableHours, dividendLimit, employerCost, equivalentEmployeeSalary,
} from './engine.js';
import { getYearParams, LAST_YEAR } from './params.js';
import { grundavdragGroup } from './grundavdrag.js';

const $ = (id) => document.getElementById(id);
const num = (id) => (($(id).value === '') ? NaN : Number($(id).value));

// ctx: { kommunRates(), engineData, ensureGrundavdragTable(year, group), setOutput(el, v, d), onConnect(kind, values) }
export function initQuick(ctx) {
  const ratesFor = (year, kommun) => (ctx.kommunRates()[year] ?? ctx.kommunRates()[LAST_YEAR] ?? {})[kommun];

  function fillKommunSelects() {
    for (const sel of document.querySelectorAll('[data-kommun-select]')) {
      const current = sel.value || 'STOCKHOLM';
      sel.replaceChildren(...Object.keys(ctx.kommunRates()[LAST_YEAR] ?? {}).map((k) => new Option(k, k, false, k === current)));
    }
  }

  async function person(prefix) {
    const year = num(`${prefix}-year`);
    const yearBorn = num(`${prefix}-yearBorn`);
    const rates = ratesFor(year, $(`${prefix}-kommun`).value);
    const p = getYearParams(year); // throws for unsupported years
    const age = year - yearBorn - 1;
    if (!isNaN(age)) await ctx.ensureGrundavdragTable(year, grundavdragGroup(age, p.forhojtGrundavdragAge));
    return {
      year,
      yearBorn,
      kommunalSkattPercent: rates ? rates[0] : NaN,
      burialSkattPercent: rates ? rates[1] : NaN,
    };
  }

  const out = (id, v, d = 0) => ctx.setOutput($(id), v, d);
  const clear = (ids) => ids.forEach((id) => out(id, NaN));

  const calculators = {
    async privat() {
      const ids = ['qp-grundavdrag', 'qp-kommunalSkatt', 'qp-statligSkatt', 'qp-allmanPensionsAvgift', 'qp-jobbskatteavdrag', 'qp-publicServiceSkatt', 'qp-incomeTax', 'qp-netMonth'];
      try {
        const income = num('qp-income');
        const r = privateIncomeTax({ ...(await person('qp')), churchSkattPercent: num('qp-church') || 0, income }, ctx.engineData);
        for (const k of ['grundavdrag', 'kommunalSkatt', 'statligSkatt', 'allmanPensionsAvgift', 'jobbskatteavdrag', 'publicServiceSkatt', 'incomeTax']) out(`qp-${k}`, r[k]);
        out('qp-netMonth', (income - r.incomeTax) / 12);
      } catch {
        clear(ids);
      }
    },
    faktura() {
      const hours = $('qf-start').value && $('qf-end').value
        ? billableHours({ startDate: $('qf-start').value, endDate: $('qf-end').value, workingRatePercent: num('qf-working'), vacationDays: num('qf-vacation') || 0 })
        : NaN;
      out('qf-hours', hours);
      out('qf-amount', hours * num('qf-rate'));
    },
    grans() {
      try {
        const d = dividendLimit({
          year: num('qg-year'),
          ownSalary: num('qg-ownSalary'),
          totalSalary: num('qg-totalSalary'),
          ownership: num('qg-ownership') / 100,
          omkostnadsbelopp: num('qg-omkostnadsbelopp'),
          savedDividends: num('qg-saved') || 0,
        });
        out('qg-grundbelopp', d.grundbelopp);
        out('qg-forenklingsregeln', d.forenklingsregeln);
        out('qg-salaryBasedLimit', d.salaryBasedLimit);
        out('qg-omkostnadsbeloppInterest', d.omkostnadsbeloppInterest);
        out('qg-limit', d.limit);
      } catch {
        clear(['qg-grundbelopp', 'qg-forenklingsregeln', 'qg-salaryBasedLimit', 'qg-omkostnadsbeloppInterest', 'qg-limit']);
      }
    },
    kostnad() {
      const c = employerCost({ grossSalaryMonth: num('qk-salary'), usePension: $('qk-pension').checked });
      out('qk-agavg', c.arbetsgivaravgift);
      out('qk-pensionAmount', c.pension);
      out('qk-slp', c.slp);
      out('qk-total', c.total);
    },
    async motsv() {
      try {
        const r = equivalentEmployeeSalary({ targetNetMonth: num('qm-net'), ...(await person('qm')) }, ctx.engineData);
        out('qm-gross', r.grossSalaryMonth);
      } catch {
        out('qm-gross', NaN);
      }
    },
  };

  const cardOf = (el) => el.closest('[data-quick-card]')?.dataset.quickCard;
  document.getElementById('quickMode').addEventListener('input', (e) => {
    const kind = cardOf(e.target);
    if (kind) calculators[kind]();
  });
  document.getElementById('quickMode').addEventListener('change', (e) => {
    const kind = cardOf(e.target);
    if (kind) calculators[kind]();
  });

  function show(kind) {
    for (const b of document.querySelectorAll('[data-quick]')) b.setAttribute('aria-pressed', b.dataset.quick === kind);
    for (const c of document.querySelectorAll('[data-quick-card]')) c.hidden = c.dataset.quickCard !== kind;
    calculators[kind]();
  }
  for (const b of document.querySelectorAll('[data-quick]')) b.addEventListener('click', () => show(b.dataset.quick));

  const values = {
    privat: () => ({ year: num('qp-year'), yearBorn: num('qp-yearBorn'), kommun: $('qp-kommun').value, income: num('qp-income') }),
    faktura: () => ({ hourlyRate: num('qf-rate'), billingStartDate: $('qf-start').value, billingEndDate: $('qf-end').value, vacationDays: num('qf-vacation'), workingRate: num('qf-working') }),
    grans: () => ({ year: num('qg-year'), omkostnadsbelopp: num('qg-omkostnadsbelopp'), savedDividends: num('qg-saved') }),
    kostnad: () => ({ grossSalaryMonth: num('qk-salary'), usePension: $('qk-pension').checked }),
  };
  for (const b of document.querySelectorAll('[data-connect]')) {
    b.addEventListener('click', () => ctx.onConnect(b.dataset.connect, values[b.dataset.connect]()));
  }
  $('qm-fromStructure').addEventListener('click', () => {
    const s = ctx.structureSummary();
    if (Number.isFinite(s.netSumMonth)) $('qm-net').value = Math.round(s.netSumMonth);
    if (s.year) $('qm-year').value = s.year;
    if (s.yearBorn) $('qm-yearBorn').value = s.yearBorn;
    if (s.kommun) $('qm-kommun').value = s.kommun;
    calculators.motsv();
  });

  return {
    refresh() {
      fillKommunSelects();
      const active = document.querySelector('[data-quick][aria-pressed="true"]')?.dataset.quick ?? 'privat';
      calculators[active]();
    },
  };
}
