# ConsultingBudgetCalculator
Tools for budgeting for consultants in Sweden

https://mikaeltulldahl.github.io/ConsultingBudgetCalculator/

Everything is calculated in your browser; nothing you enter is sent anywhere.

## How the page is organised

- **Min struktur**: a map of your setup (assignments → your company → the people in it,
  plus any salary from another employer). Each box and arrow opens its own calculator card:
  one Uppdrag and one Fakturerat card per assignment (with price changes during the
  assignment), Ditt aktiebolag, and per person Lön, Tjänstepension, Utdelning, Annan
  anställning and the person card. On phones the map becomes a vertical flow.
- **Several people** ("+ Person"): each person is an owner (share in %), an employee, or
  both, with their own birth year, kommun, salary, pension and 3:12 data. Dividends are
  paid per share; "maximal utdelning" is the largest total where no owner goes above their
  own gränsbelopp. All shares can be entered together under Ägare on the company card. Shares below 100 % in total mean the rest belongs to other owners outside the calculation (they get their dividend per share, but their limits and taxes are not modelled); above 100 % gives no dividend.
- **Snabbräknare**: five stand-alone calculators (Privat skatt, Fakturerat belopp,
  Utdelningsgräns, Lön ↔ bolagskostnad, Motsvarande anställning). "Koppla in i min
  struktur" copies their values into the structure.
- Every field has an ⓘ explanation (what it is, how it is calculated, source), kept in
  `js/explanations.js`; the CSV export uses the same texts.

## Your data

- What you fill in is remembered in your own browser (localStorage) until you click
  "Rensa mina uppgifter". It is never sent anywhere.
- "Exportera mina uppgifter" saves everything, including saved scenarios, to a JSON file
  that can be imported again, e.g. on another computer.
- "Exportera till Excel (CSV)" downloads every field and calculated value, in page order,
  with the explanation of how each value is calculated. The file uses semicolons and
  decimal commas, as Swedish Excel expects.
- Scenarios can be saved under a name and compared side by side (the first person and the
  company's totals).

## How the calculations are verified

The private income tax is tested against Skatteverket's own calculator
([Räkna ut din skatt](https://www7.skatteverket.se/portal/rakna-ut-skatt)):
814 cases for 2020–2026 (ages 30–80, incomes 0–2 000 000 kr, with and without church
membership) match on every component, to the krona. Other tests check grundavdrag against
Skatteverket's published tables, 3:12 amounts against published values, holidays, and
invariants such as "money is conserved" and "net pay grows with gross pay".

## Structure

| Path | What |
|---|---|
| `index.html` | The page (markup and styles). |
| `js/app.js` | Page logic: reads the form, runs the engine, draws charts. |
| `js/engine.js` | All calculations. Pure functions, no DOM or network. |
| `js/params.js` | Tax parameters per year. |
| `js/grundavdrag.js`, `js/holidays.js` | Grundavdrag and Swedish holidays. |
| `js/scenario.js`, `js/storage.js` | Saved data format (version 3 with several people; versions 1 and 2 are converted), export/import, CSV, browser storage. |
| `js/assignments.js` | Billable hours and invoiced amount per assignment, with price changes. |
| `js/structure.js`, `js/quick.js` | Structure map / phone flow, and the quick calculators. |
| `js/explanations.js` | Explanation texts and sources for every field. |
| `css/style.css` | Styles, light and dark theme. |
| `data/` | Kommun tax rates and förhöjt grundavdrag tables, served with the page. |
| `tests/` | Tests (`node --test`, no dependencies). |
| `tools/` | Scripts that download data and reference cases. |

## Running locally

The page uses JavaScript modules, so it must be served over HTTP (opening the file
directly does not work):

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Tests

Requires Node.js 22 or later.

```bash
npm test
```

Browser test of remembering data, export/import, CSV and scenarios (needs Playwright with
Chromium and network access; not run in CI):

```bash
npm run test:e2e
```

`tests/regression/snapshot.json` stores the engine output for a fixed set of inputs. After
an intentional change to the calculations, regenerate it and review the diff:

```bash
npm run update-snapshots
```

## Adding a new year

1. Add a block for the year in `js/params.js` (prisbasbelopp, inkomstbasbelopp,
   skiktgräns, public service-avgift, jobbskatteavdrag coefficients, klyvningsränta and
   the rule flags). Brytpunkt is computed automatically.
2. Download kommun rates and grundavdrag tables (needs network access):
   ```bash
   node tools/fetch-kommuner.mjs 2027
   ```
   ```bash
   node tools/fetch-grundavdrag.mjs 2027
   ```
3. Download reference cases from Skatteverket's calculator (needs Playwright with Chromium):
   ```bash
   node tools/skatteverket/fetch-cases.mjs 2027
   ```
4. Run `npm test`. A failing Skatteverket test points to the rule that changed.

Behind an HTTP proxy, run the Node scripts with `NODE_USE_ENV_PROXY=1`.

## Visitor statistics

The page counts page views with [GoatCounter](https://www.goatcounter.com): no cookies,
no personal data, no other events (nothing about what people type or export). Statistics
are at https://mikaeltulldahl.goatcounter.com. The site code is `GOATCOUNTER_CODE` in
`js/app.js`; visits from localhost are not counted.
