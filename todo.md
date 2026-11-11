# TODO

Only what is still open. What has been built is in `git log` (milestones 1–5 part 1: engine,
structure map, quick calculators, explanations, pension, other income, several assignments
with price changes, several owners/employees, saved data and import/export).

## Checks
- [ ] e2e: second owner (two person boxes, equal dividend per share, tightest limit noted,
      shares > 100 % warning), employee without shares, remove person, reload/export/import.
      Needs Playwright installed to run (`npm run test:e2e`).
- [ ] Double check the business logic for several owners (limits per owner, who caps the total).
- [ ] Phone-width check of the new cards (person, owners, vacation per period).

## Rules and model
- [ ] Dividend rules for sambo and married people (e.g. spouse's shares, 3:12 attribution).
- [ ] Several companies and common structures (holding company, shell companies).
- [ ] Multi-year analysis: the rules for trädabolag / karensbolag.
- [ ] Fiscal year not starting 1 January.
- [x] "Anställd i bolaget" removed: a person is employed when the salary and months are above 0.
- [ ] Smarter salary choices than "up to brytpunkt": e.g. highest salary with no profit left,
      the salary that maximises net for everyone, lowest total tax. Other ideas?
- [ ] Fetch constants from external sources so they need no yearly update (3:12, tax rates).
- [ ] Decimal library and central rounding (optional); TypeScript (optional).
- [ ] Verify a few critical cases by hand against Skatteverket.

## Page
- [ ] More explanations in the UI and more on how to use the tool.
