# ConsultingBudgetCalculator
Tools for budgeting for consultants in Sweden

https://mikaeltulldahl.github.io/ConsultingBudgetCalculator/

Everything is calculated in your browser; nothing you enter is sent anywhere.

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
