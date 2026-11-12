# Research: several companies, holding structures, multi-year (3:12), spouses

Research date: 2026-11-12. Scope: Swedish 3:12 rules (57 kap. inkomstskattelagen, IL) for
several companies per person, holding structures, multi-year carry-over, trädabolag/karens,
and spouses/sambo. No code was changed.

"IY" = inkomstår (income year). "IBB" = inkomstbasbelopp. "LU" = lönebaserat utrymme.
Confidence: **High** = read in law text or Skatteverket; **Medium** = follows from the law
text by my own reasoning, or secondary source; **Low** = not verified.

## Sources (all fetched 2026-11-12)

| Id | Source | URL |
|---|---|---|
| S1 | SFS 2025:1361, lag om ändring i inkomstskattelagen (published 2025-12-03; the 2026 reform, full new wording of 57 kap. 3–6, 10–13, 15–17 a, 19 a, 21 §§ and transitional rules) | https://svenskforfattningssamling.se/sites/default/files/sfs/2025-11/SFS2025-1361.pdf |
| S2 | Prop. 2025/26:1 (budgetpropositionen för 2026), avsnitt 13.8, p. 284–329, and författningskommentar p. 422–427 | https://www.regeringen.se/contentassets/3416d1df56ae4fcaacf03ecd8ed81ab1/forslag-till-statens-budget-for-2026-finansplan-och-skattefragor-kapitel-1-13-bilagor-1-14/ |
| S3 | Skatteverket: Ändrade regler för delägare i fåmansföretag inför inkomstdeklarationen 2027 (IY 2026, with worked examples) | https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/andradereglerinforinkomstdeklarationen2027.4.4a54dc8b19aa6175a152359.html |
| S4 | Skatteverket: Belopp och procentsatser (fåmansföretag), IY 2019–2027 | https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/beloppochprocentsatser.4.34f3b0b713e2cf5455b7288.html |
| S5 | Skatteverket: Räkna ut skatten på din utdelning (describes IY 2025 rules, worked examples) | https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/raknautskattenpadinutdelning.4.b1014b415f3321c0de27ce.html |
| S6 | Skatteverket: Fåmansföretag och kvalificerade andelar (IY 2025 wording) | https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/famansforetagochkvalificeradeandelar.4.6efe6285127ab4f1d2580001532.html |
| S7 | Skatteverket broschyr SKV 292 utgåva 34, Skatteregler för delägare i fåmansföretag (IY 2025) | https://skatteverket.se/download/18.1522bf3f19aea8075ba4f3e/1768831040199/skatteregler-for-delagare-i-famansforetag-skv292-utgava34.pdf |
| S8 | Skatteverket Rättslig vägledning 2026 (edition 2026.14): Beräkning av gränsbelopp | https://www4.skatteverket.se/rattsligvagledning/edition/2026.14/331735.html |
| S9 | Rättslig vägledning 2026: Lönebaserat utrymme | https://www4.skatteverket.se/rattsligvagledning/edition/2026.14/331738.html |
| S10 | Rättslig vägledning 2026: Sparat utdelningsutrymme | https://www4.skatteverket.se/rattsligvagledning/edition/2026.14/331745.html |
| S11 | Rättslig vägledning 2026: Beskattning av utdelning | https://www4.skatteverket.se/rattsligvagledning/edition/2026.14/331743.html |
| S12 | Rättslig vägledning 2026: När är en andel kvalificerad? | https://www4.skatteverket.se/rattsligvagledning/edition/2026.14/331732.html |
| S13 | Rättslig vägledning 2026: Samma eller likartad verksamhet / Verksam i betydande omfattning | https://www4.skatteverket.se/rattsligvagledning/edition/2026.14/331736.html and .../331734.html |
| S14 | Rättslig vägledning 2026: Begränsning av beskattning som inkomst av tjänst (takbelopp) | https://www4.skatteverket.se/rattsligvagledning/edition/2026.14/331747.html |
| S15 | Rättslig vägledning 2026: Skatteberäkning inom familjen (57 kap. 36 § IL) | https://www4.skatteverket.se/rattsligvagledning/edition/2026.14/331752.html |
| S16 | Inkomstskattelagen (1999:1229), consolidated incl. SFS 2025:1361 (2 kap. 20, 22 §§; 24 kap. 32–35 §§; 35 kap. 2–3 §§; 42 kap. 15 a §; 53 kap. 2–5 §§; 57 kap.) | https://lagen.nu/1999:1229 |
| S17 | Skatteverket: Försäljning av kvalificerade aktier; Aktier vid arv, gåva eller bodelning; Utdelning från ditt fåmansföretag | https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/forsaljningavkvalificeradeaktierkonkursellerlikvidation.4.b1014b415f3321c0de2820.html (and sibling pages) |

Note: www4.skatteverket.se/rattsligvagledning blocks scripted fetches; the pages were read in
a normal browser. The "Rättslig vägledning" pages have one edition per year (2015–2026), so
the same page id gives the rules for older years.

---

## 1. Summary

1. **From IY 2026 there is one formula** (S1 57 kap. 10–11 §§, S3):
   gränsbelopp = grundbelopp-share + LU + ränta on omkostnadsbelopp above 100 000 kr + sparat
   utdelningsutrymme. Förenklingsregeln, huvudregeln, löneuttagskravet and the 4 %
   kapitalandelskrav are gone. Existing code matches Skatteverket's 2026 examples for a single
   owner and for unrelated co-owners.
2. **One grundbelopp per person, across all companies** (57 kap. 11 a §). The grundbelopp
   (4 × IBB of the year before; 322 400 kr for IY 2026, 333 600 kr for IY 2027) is per
   company and split per share. If a person's shares in several companies add up to more
   than 100 %, each company gets grundbelopp × share ÷ sum of shares. The existing
   `ownershipInOtherCompanies` formula is **correct** for 2026 (checked against Skatteverket's
   Tove example and the proposition's example), but the page never passes the parameter.
3. **The 8 IBB "löneavdrag" is per owner and per company** (644 800 kr for IY 2026), except
   that **spouses owning shares in the same company compute LU jointly** with one deduction
   (57 kap. 16 § 2 st.). The code does not handle spouses and gives too low limits for them.
4. **Bug in the 2026 LU cap**: the cap "50 × own or närstående's cash salary" applies to the
   LU itself, not to the amount before the 50 % (S1 16 § 3 st.). The code halves the cap.
5. **Sparat utdelningsutrymme is no longer indexed from IY 2026** (S1 13 §, S3). Up to IY
   2025 it was increased by statslåneräntan + 3 percentage points (4,96 % for IY 2025). The
   code never applies the indexation for IY ≤ 2025, so it is off for those years unless the
   user enters an already indexed amount.
6. **LU uses the wages of the calendar year before the income year**, and the owner must own
   the shares at 1 January to get any årets gränsbelopp. The code uses the same year's
   salary, which is only right in a steady state. This is the main reason to build the
   multi-year model.
7. **Holding company**: a personal holding that owns the operating company is itself a
   fåmansföretag and its shares are qualified (57 kap. 4 § 1 st. 2). Dividends
   driftbolag → holding are tax-free (24 kap. 32–35 §§ IL). Wages in a *dotterföretag* count
   in the holding's löneunderlag in proportion to the holding's share. Total tax is the same
   as with direct ownership; what changes is timing, the number of grundbelopp among partners,
   and the possibility to sell the operating company tax-free and wait out the karens.
8. **Karens / trädabolag**: shares stay qualified during the income year and the **five**
   previous years in which the owner or a närstående was active; from **IY 2027 it is four**
   years (S1 4 § and transitional rule 5). After that, dividends and gains are taxed at 25 %
   (5/6 × 30 %, 42 kap. 15 a §) with no limit. Owners who stopped working in 2021 *and* in
   2022 both become free in IY 2027.
9. **Dividend above the gränsbelopp** is taxed as tjänst at the owner's marginal rate, up to
   90 IBB of the income year per company and närståendekrets (7 506 000 kr for IY 2026);
   above that 30 %. For spouses the tax on that part is computed as if the owner had the
   active spouse's income (57 kap. 36 §).
10. **Sambo** are treated as spouses only if they have been married to each other or have
    or have had a child together (2 kap. 20 § IL). Other sambo are not närstående at all.

**Not sure about / not verified:**
- IBB for 2027 was not found as decided on 2026-11-12 (a forecast of 87 200 kr circulates,
  unverified). It sets the IY 2027 takbelopp and the IY 2028 grundbelopp. Statslåneräntan
  per 2026-11-30 (ränta for IY 2027) does not exist yet.
- The layout and field numbers of the new K10 form for IY 2026 (SKV 2110) were not found.
- What happens to sparat utdelningsutrymme when a person sells qualified shares to their own
  holding company at omkostnadsbelopp (I believe the unused room is lost; **Medium**, not
  found in a primary source).
- Company-law timing of passing a dividend through a holding in the same year (**Medium**).
- Whether tjänst-taxed dividend gets grundavdrag (SKV 292 p. 28 says no grundavdrag is made
  from these incomes; not cross-checked against Skatteverket's calculator).
- Utomståenderegeln when a non-närstående sambo owns ≥ 30 % (**Low**, see 2.6).

---

## 2. Rules by topic

### 2.1 Gränsbelopp, the 2026 reform (what changed on 1 January 2026)

In force 2026-01-01, applies to beskattningsår starting after 2025-12-31 (S1, transitional
rules 1–2). Confidence **High** for everything in this table.

| Item | IY ≤ 2025 | IY 2026 → | Source |
|---|---|---|---|
| Methods | max(förenklingsregeln, huvudregeln), per owner per company | One formula: grundbelopp + LU + ränta + sparat | S1 10–11 §§, S3 |
| Schablon | 2,75 × IBB(year−1) per company, split per share. Only **one** company per person may use förenklingsregeln; huvudregeln in the others | Grundbelopp 4 × IBB(year−1) per company, split per share, max one per person (11 a §) | S7 p. 11, S5; S1 11–11 a §§ |
| IBB used | IBB of the year before the income year (57 kap. 9 §) | Same | S16, S8 |
| LU | 50 % × löneunderlag × share | 50 % × max(0, löneunderlag × share − 8 × IBB(year−1)) | S5; S1 16 §, S3 |
| LU cap | 50 × own or närstående's cash salary from the company and its dotterföretag, year before | Same (applies to the LU for all the owner's shares) | S5; S1 16 § 3 st. |
| Löneuttagskrav | Own or närstående's cash salary year before ≥ min(9,6 × IBB(year−1); 6 × IBB(year−1) + 5 % of all cash wages in company and dotterföretag) | **Removed** | S5, S4; S3 |
| Kapitalandelskrav | Must own ≥ 4 % of the capital at 1 Jan to get LU. No närstående rule | **Removed** | S7 p. 11; S3 |
| Löneunderlag year | Cash wages paid the calendar year before the income year, also with brutet räkenskapsår | Same | S9, S1 17 § |
| Ränta on omkostnadsbelopp | (statslåneränta 30 Nov year−1 + 9 pp) × whole omkostnadsbelopp, only in huvudregeln | Same rate, but only on the part of the owner's omkostnadsbelopp above 100 000 kr (per owner, per share class) | S1 11 § 2 st., S3 |
| Statslåneränta floor | 0 % (57 kap. 8 §) | Same | S16 |
| Indexing of sparat utdelningsutrymme | × (1 + statslåneränta + 3 pp) | **None** | S7 p. 11; S1 13 §, S3 |
| Dotterföretag (for löneunderlag) | Parent owns > 50 % of the capital, directly or through another dotterföretag (old 19 a §) | Civil-law definition (ABL 1 kap. 11 §, ÅRL 1 kap. 4 §), e.g. majority of votes. Because löneunderlag is last year's wages, it already applies to 2025 wages. Handelsbolag must still be 100 % owned | S3, S9, S2 p. 296–298 |
| Karens when the company stops being a fåmansföretag (6 §) | 5 years | 4 years, from IY 2026 | S1 6 §, S3 |
| Look-back in 3, 4, 5 §§ (kvalificerad andel, utvidgad fåmansföretagsdefinition, utomståenderegeln) | 5 previous years (still for IY 2026) | 4 previous years **from IY 2027** | S1 transitional rule 5, S2 13.8.14 |
| Tax within gränsbelopp | 2/3 × 30 % = 20 % | Same | 57 kap. 20 § |
| Above gränsbelopp | Tjänst, max 90 IBB (dividend) / 100 IBB (gain) | Same | 57 kap. 20 a, 22 §§ |
| Index-/kapitalunderlagsregeln (shares bought before 1990/1992) | Apply | Still apply through IY 2028, removed from IY 2029 | S1 transitional rule 6 |
| K10 | Page 1 förenklingsregeln, page 2 huvudregeln (fields 1.x / 2.x) | New K10 (SKV 2110). Layout not verified | S7; Low |

Constants (S4; all **High**):

| IY | IBB(year−1) used | Schablon 2,75 IBB | Grundbelopp 4 IBB | Lönekrav max (9,6 IBB) | Lönekrav base (6 IBB) | Ränta omkostnadsbelopp | Indexing sparat | Tak utdelning (90 × IBB of IY) | Tak vinst (100 × IBB of IY) |
|---|---|---|---|---|---|---|---|---|---|
| 2020 | 64 400 | 177 100 | – | 618 240 | 386 400 | 9,00 % | 3,00 % | 6 012 000 | 6 680 000 |
| 2021 | 66 800 | 183 700 | – | 641 280 | 400 800 | 9,00 % | 3,00 % | 6 138 000 | 6 820 000 |
| 2022 | 68 200 | 187 550 | – | 654 720 | 409 200 | 9,23 % | 3,23 % | 6 390 000 | 7 100 000 |
| 2023 | 71 000 | 195 250 | – | 681 600 | 426 000 | 10,94 % | 4,94 % | 6 687 000 | 7 430 000 |
| 2024 | 74 300 | 204 325 | – | 713 280 | 445 800 | 11,62 % | 5,62 % | 6 858 000 | 7 620 000 |
| 2025 | 76 200 | 209 550 | – | 731 520 | 457 200 | 10,96 % | 4,96 % | 7 254 000 | 8 060 000 |
| 2026 | 80 600 | – | 322 400 | – | – | 11,55 % (above 100 000 kr) | none | 7 506 000 | 8 340 000 |
| 2027 | 83 400 | – | 333 600 | – | – | not set until 2026-11-30 | none | 90 × IBB 2027 (not decided) | 100 × IBB 2027 |

The 8 IBB deduction is 644 800 kr for IY 2026 and 667 200 kr for IY 2027 (8 × 83 400).

Other points (**High**):
- Årets gränsbelopp is computed at 1 January and belongs to whoever owns the share then
  (57 kap. 11 § 4 st.). No gränsbelopp for the year the company is started or the shares are
  bought; a dividend that year is taxed entirely as tjänst (S5 Oliver example, S7 p. 16–19).
- With a gift, inheritance or bodelning the receiver steps into the giver's position for
  årets gränsbelopp, omkostnadsbelopp and sparat utdelningsutrymme (57 kap. 11 § 4 st.,
  14 §; S17).
- If shares were owned only part of the previous year, only wages paid during that time
  count; the 8 IBB deduction is still made only once (16 a §, S3).
- Wages covered by state wage subsidies do not count (18 §). Benefits, pension and
  kostnadsersättning do not count; styrelsearvode does not count (S9).

### 2.2 Several companies owned directly by one person

| Rule | Years | Source | Conf. |
|---|---|---|---|
| Gränsbelopp, sparat utdelningsutrymme, omkostnadsbelopp and K10 are **per company** (and per share class). Room in one company cannot be used for dividends from another | all | 57 kap. 10–13 §§; S10; S2 p. 329 ("en bilaga för varje företag") | High |
| Förenklingsregeln may be used in **at most one** company; the others must use huvudregeln (which can give 0 if no wages and small omkostnadsbelopp) | IY 2012–2025 | S7 p. 11, 30; S5 | High |
| One grundbelopp per person. If Σ shares ≤ 100 %: grundbelopp_i = G × s_i. If Σ shares > 100 %: grundbelopp_i = G × s_i ÷ Σ s. "Share" = share of the capital. Only companies where the person owns **qualified** shares count. No free choice of company | IY 2026 → | S1 11 a §; S2 p. 290, 423; S3 (Ismail, Tove); S8 | High |
| The reallocation for one owner does not change other owners' grundbelopp | IY 2026 → | S2 p. 290 | High |
| LU is computed per company: löneunderlag of that company and its dotterföretag × share − 8 IBB. So the 8 IBB deduction is made **in each directly owned company** | IY 2026 → | S1 16–17 §§ | High (law text); no official example with two companies |
| Takbelopp 90 IBB (dividend) and 100 IBB (gain) are per company | all | S14 | High |
| A dormant company whose shares are still qualified (within karens) counts as one of the "several companies" and takes its part of the grundbelopp | IY 2026 → | follows from 11 a § + 4 § | Medium |
| Shares in a second company can be qualified only because it runs "samma eller likartad verksamhet" as a company where the person is active. In practice this needs a transfer of business or capital between the companies, not just the same trade | all | 57 kap. 4 § 1 st. 3; S13 (RÅ 1999 ref. 28, HFD 2018 not. 23) | High |

### 2.3 Holding structures

Typical setups for consultants, and how they are taxed:

**A. Person → Holding AB (100 %) → Driftbolag AB (100 %)**. The most common one.

| Step | Rule | Source | Conf. |
|---|---|---|---|
| Holding shares are qualified | The holding is a fåmansföretag; its shares are qualified if the holding, directly or indirectly, owns or during the look-back period has owned shares in a fåmansföretag where the owner or a närstående was active. Applies whether or not it is a koncern | 57 kap. 4 § 1 st. 2; S12 | High |
| Tax in driftbolag | Bolagsskatt 20,6 % on the profit | 65 kap. 10 § IL | High |
| Dividend driftbolag → holding | Not taxed: unlisted shares held as capital assets by an AB are always näringsbetingade; dividend on them is not taken up. Capital gain on them is also tax-free (and losses not deductible) | 24 kap. 32, 33, 35 §§; 25 a kap. IL | High (dividend); gain rule from memory of 25 a kap. 5 § (Medium) |
| Koncernbidrag | Deductible for the giver and taxable for the receiver if the parent owns **more than 90 %** of the shares, both report it openly the same year, and (my reading of 35 kap. 3 § 3) the subsidiary has been wholly owned the whole beskattningsår or since it started its business. Moves taxable profit between the two; total bolagsskatt unchanged at 20,6 % | 35 kap. 2–3 §§ | High for >90 %; Medium for the whole-year condition (not re-read) |
| Tax in holding | 20,6 % only on its own taxable income (interest, koncernbidrag received, gains on non-näringsbetingade assets such as listed shares < 10 % and funds). Costs deductible | – | High |
| Dividend holding → person | K10 for the **holding** shares: 20 % within gränsbelopp, tjänst above | 57 kap. 20 § | High |
| Grundbelopp | One, in the holding (the person owns no shares directly in the driftbolag) | 11 § | High |
| Löneunderlag | Cash wages the year before in the holding **and its dotterföretag**; for a dotterföretag that is not wholly owned, only the parent's share of the wages; only wages paid while it was a dotterföretag | 57 kap. 17 §; S5 Noah example; S9 | High |
| 8 IBB deduction | Once, on the owner's share of the consolidated löneunderlag | 16 § | High |
| 50 × cap and (≤ 2025) lönekrav | Count salary the owner or a närstående got from the company **or its dotterföretag**, so salary taken in the driftbolag counts for the holding shares. For the lönekrav ≤ 2025 all wages in dotterföretag count regardless of ownership share | S3; S7 K10 footnotes | High |
| 4 % rule (≤ 2025) | Measured on the person's share of the holding | S7 | High |
| Total tax | Same as direct ownership: 1 − (1 − 0,206) × (1 − 0,20) = 36,48 % on profit paid out within the gränsbelopp | arithmetic | High |

**B. Several partners, each with a personal holding that owns part of a joint driftbolag**
(e.g. 4 consultants, 25 % each).

- Each partner owns 100 % of their own holding, so each gets a **full** grundbelopp
  (förenklingsregelns schablonbelopp before 2026). With direct ownership of 25 % each they
  would get a quarter each. **Medium** (follows from 11 §; no official example).
- Wages in the joint driftbolag count for a holding only if the driftbolag is that
  holding's dotterföretag (> 50 % of capital before 2026; civil-law definition, e.g. majority
  of votes, from 2026). With 25 % each, **no** LU from the driftbolag for anyone. The
  government explicitly declined to extend LU to holdings below subsidiary level (S2 p. 298).
  **High**.
- Dividends driftbolag → holdings are tax-free and need not be passed on in the same
  proportions or at the same time to the individuals, which is the main practical reason for
  this setup.
- Before 2026 the special > 50 % definition existed to stop avoiding the 4 % rule this way.

**C. Person owns two operating companies directly**: see 2.2. Two 8 IBB deductions and a
split grundbelopp; putting both under one holding gives one consolidated löneunderlag and one
deduction (**Medium**, my reading of 16–17 §§).

**D. Person → Holding → driftbolag sold, holding kept as trädabolag**: see 2.5.

**Internal share transfer to form a holding afterwards** (person sells driftbolag shares to
own new holding): if the price is below both market value and omkostnadsbelopp, the shares
are treated as sold for the omkostnadsbelopp, i.e. no gain, and the omkostnadsbelopp of the
holding shares is increased by the difference (53 kap. 2–5 §§ IL, **High**). Sold for exactly
the omkostnadsbelopp: no gain. The person does not own the holding shares at 1 January of
the formation year, so no årets gränsbelopp for the holding that year (**High**, 11 § 4 st.).
Sparat utdelningsutrymme on the sold driftbolag shares can be used against a gain on that
sale; I believe what is not used is lost, since 57 kap. 15 § only moves saved room at
andelsbyte, partiell fission and for särskilt kvalificerade andelar (**Medium**, not
confirmed in a primary source). An andelsbyte (shares paid with new holding shares, 48 a
kap.) does carry the saved room over (15 § 1 st., **High**).

"Tomma bolag"/shell companies: selling a company that mainly holds cash can trigger the
skalbolag rules (49 a kap. IL, gain taxed as business income). Not researched further;
outside a budget calculator.

Management company: a personal company that invoices the operating company for the owner's
work is simply case B or an ordinary single company from the calculator's point of view.

### 2.4 Multi-year: sparat utdelningsutrymme and the order of use

| Rule | Years | Source | Conf. |
|---|---|---|---|
| saved_out(Y) = gränsbelopp(Y) − dividend taxed within it (≥ 0). If no dividend, the whole gränsbelopp is saved | all | 57 kap. 13 § | High |
| saved_in(Y) = saved_out(Y−1) × (1 + statslåneränta(30 Nov Y−1) + 3 pp) | IY ≤ 2025 | S7 p. 11; S4 | High |
| saved_in(Y) = saved_out(Y−1), no indexation. No transitional rule: room saved up to 2025 (already indexed for the 2025 computation) is carried into 2026 at its nominal value | IY 2026 → | S1 13 §; S3 Valter example | High |
| Room is per person, per company, per share class. Cannot be moved between companies | all | S10 | High |
| Several dividends in one year: what is left after the first is the limit for the next; the same remainder is the limit for a capital gain the same year | all | 13 § | High |
| Sale of the shares: gain within remaining gränsbelopp (årets + saved) is taxed 20 %; above that tjänst up to 100 IBB (of the sale year, counting the sale year and five previous years, per company and närståendekrets); above that 30 % | all | 57 kap. 21–22 §§; S7 p. 20, 24 | High |
| Unused saved room disappears when the shares are sold to an outsider; it follows the shares at gift, inheritance, bodelning | all | 57 kap. 14 §; S17 | High |
| Loss on qualified shares: 2/3 deductible against share gains, the rest × 70 % | all | S17 | High |
| If shares are not qualified "något år" the saved room is carried on (without indexing in that time before 2026). Skatteverket: at most two non-qualified years | all | 13 § 2 st.; S10 | High |
| The owner at 1 January gets årets gränsbelopp even if no dividend is paid; file K10 every year | all | S5, S8 | High |

**Dividend above the gränsbelopp ("överskjutande utdelning")** (**High** unless noted):
- Taxed as inkomst av tjänst for the shareholder: kommunal + statlig skatt at the marginal
  rate. No arbetsgivaravgifter; not pensionsgrundande (S7 p. 28). It is not arbetsinkomst,
  so no jobbskatteavdrag (**Medium**, standard, not re-read).
- Cap: the owner and närstående together are taxed as tjänst on at most 90 × IBB of the
  income year per company and year (7 254 000 kr IY 2025, 7 506 000 kr IY 2026); the rest
  is taxed 30 % as kapital (57 kap. 20 a §; S14).
- Spouse rule: 57 kap. 36 §, see 2.6.
- Giving away the right to a dividend does not help: the receiver is taxed as tjänst on all
  of it and the gränsbelopp stays with the owner (HFD 2011 ref. 24; S11).
- A dividend that follows work effort rather than shares can be taxed as salary
  (RÅ 2000 ref. 56, HFD 2019 ref. 52; S11).

### 2.5 Karens and trädabolag ("5:25-bolag", from 2027 in practice four years)

"Trädabolag" / "karensbolag" / "vilande bolag" are informal names for a company left without
activity so that the shares stop being qualified.

| Rule | Years | Source | Conf. |
|---|---|---|---|
| A share is qualified if the owner or a närstående was verksam i betydande omfattning in the company (or in a fåmansföretag it owns or has owned, or in one with samma eller likartad verksamhet) during the income year or any of the **five** previous years | IY ≤ 2026 | 57 kap. 4 §; S6; S12 | High |
| Same, **four** previous years | IY 2027 → | S1 4 § + transitional rule 5; S12 | High |
| Timeline: last active year L. Old rule: qualified through L+5, free from L+6. New rule: qualified through L+4, free from L+5. L = 2021 → free IY 2027 (old rule). L = 2022 → free IY 2027 (new rule). L = 2023 → free 2028. L = 2025 → free 2030. L = 2026 → free 2031 | – | derived; consistent with Skatteverket's Birgitta example (stopped 2019, free IY 2025) and S2 13.8.14 | High |
| During the karens the shares are still qualified: K10, årets gränsbelopp (grundbelopp from 2026; schablonbelopp before, if förenklingsregeln is not used in another company), dividends 20 % within the limit, tjänst above | all | follows from 4, 10–11 §§ | High |
| After the karens: dividend and gain on unlisted, non-qualified shares are taken up to 5/6 → 25 % tax, no limit. Reported on K12 | all | 42 kap. 15 a § IL; S17 | High |
| Starting any new activity in the karens company restarts everything: the whole year counts, even if the dividend was paid before the activity started | all | SRN 5-19/D in S12, S13 | High |
| Managing the company's own securities normally does not make the owner "verksam i betydande omfattning"; real estate management can | all | RÅ 2004 ref. 61 and others in S13 | High |
| "Samma eller likartad verksamhet": if business or accumulated capital is moved from the karens company to a company where the owner is active (or the reverse), the shares stay or become qualified. Just working in the same trade in a new, separate company is not enough | all | S13 (RÅ 1999 ref. 28, RÅ 2010 ref. 11, HFD 2018 not. 23) | High |
| Tilläggsköpeskilling after the sale does not by itself extend the karens | – | SRN 5-19/D in S13 | High |
| Typical use: Person → Holding → Driftbolag. Holding sells the driftbolag (gain tax-free in the holding). The owner stops working in both. After the karens the holding's money is taken out at 25 %, or the holding is liquidated at 25 % | all | combination of 24 kap./25 a kap. and 57 kap. 4 § | High in principle |
| If the *company* stops being a fåmansföretag (e.g. listing), shares stay qualified 5 years after; 4 years from IY 2026 | – | 57 kap. 6 §; S3 | High |
| Family succession exception to "samma eller likartad" (57 kap. 4 a §), not for the owner's spouse | from 2019 | S12 | High |

Typical numbers: profit taken as dividend above the gränsbelopp costs roughly 50–55 % in
tjänst at high income; inside the gränsbelopp 20 %; after the karens 25 %. On top comes the
20,6 % bolagsskatt already paid (not on a tax-free sale of näringsbetingade shares).

### 2.6 Spouses and sambo

| Rule | Years | Source | Conf. |
|---|---|---|---|
| Närstående: make, förälder, far-/morförälder, avkomling and avkomlings make, syskon, syskons make and avkomling, dödsbo. Styvbarn/fosterbarn count as children | all | 2 kap. 22 § IL; S6 | High |
| Sambo count as makar **only** if they have been married to each other or have or have had a child together. Other sambo are not närstående | all | 2 kap. 20 § IL; S6 | High |
| A passive spouse's shares are qualified because the other spouse is active | all | 57 kap. 4 § | High |
| Each spouse has their own K10, gränsbelopp and sparat utdelningsutrymme for their own shares. Dividends go per share. Schablon/grundbelopp is split per share, so splitting ownership between spouses gives no extra grundbelopp | all | 11 § | High |
| LU for two spouses owning shares in the same company (status at 1 January): computed **jointly** on the spouses' combined share with **one** 8 IBB deduction, then split per share. Applies to makar only, not children | IY 2026 → | S1 16 § 2 st.; S2 p. 295; S3 Amy/Gedion | High |
| LU cap 50 × the own **or a närstående's** salary: both spouses may use the higher salary | all | 16 § 3 st.; S3 | High |
| Lönekrav could be met by the owner or a närstående | IY ≤ 2025 | S5 | High |
| 4 % rule had no närstående rule: each spouse needed ≥ 4 % themselves | IY ≤ 2025 | S7 p. 11 | High |
| Ränta on omkostnadsbelopp: the 100 000 kr threshold is per owner | IY 2026 → | 11 § 2 st. | High |
| Dividend above the gränsbelopp to a spouse with lower income: the tax on that tjänst part is computed as if the owner had the same taxable earned income as the spouse who is or in the last five years was active. Same for children up to 18 and their parents | all (still in force 2026) | 57 kap. 36 § IL; S15 | High |
| Takbelopp 90 / 100 IBB is shared by the whole närståendekrets per company | all | 20 a, 22 §§; S14 | High |
| Gift of shares between spouses (or to children): no gain tax; the receiver takes over omkostnadsbelopp, sparat utdelningsutrymme and, for a gift during the year, the giver's årets gränsbelopp for those shares. Reported on K10 by both | all | 57 kap. 11 § 4 st., 14 §; S17 | High |
| Shares received as a gift are not qualified just because they were for the giver; the receiver must meet 4 § (always met for a spouse of an active person) | all | HFD 2016 ref. 20 in S12 | High |
| Salary to a spouse/child working in the company must be market level; above that it is taxed with the företagsledare | all | S7 p. 9–10 | High (not studied in detail) |
| Sambo who are **not** treated as makar and one is passive: the passive one's shares are not qualified through the partner (25 % tax, K12). If the passive one owns ≥ 30 % the utomståenderegeln could in theory make the active one's shares non-qualified too, unless "särskilda skäl". Expect Skatteverket to look closely | all | 57 kap. 4–5 §§; my reading | **Low** |

Since dividends within the limit are taxed at a flat 20 %, splitting shares with a spouse does
not lower that tax. The effects of spouse ownership are: who gets the money, the joint LU,
and the 36 § rule that blocks income splitting above the limit.

---

## 3. Gotchas (candidate UI texts)

1. **Bara ett grundbelopp per person.** Äger du kvalificerade aktier i flera fåmansföretag
   får du sammanlagt högst ett grundbelopp (322 400 kr för 2026). Om dina ägarandelar
   tillsammans är över 100 % fördelas beloppet mellan bolagen efter ägarandel; du kan inte
   välja bolag.
2. **Till och med 2025: förenklingsregeln i bara ett bolag.** I övriga bolag måste
   huvudregeln användas, och utan löner ger den nästan inget utrymme.
3. **Lönerna som räknas är förra årets.** Det lönebaserade utrymmet för 2026 bygger på
   kontanta löner som betalades ut under 2025. Lönen du tar i år påverkar utdelningen nästa
   år.
4. **Du måste äga aktierna den 1 januari.** Året du startar eller köper bolaget får du inget
   gränsbelopp, och utdelning det året beskattas som lön.
5. **Sparat utrymme räknas inte längre upp.** Från 2026 förs sparat utdelningsutrymme vidare
   krona för krona. Till och med 2025 räknades det upp med statslåneräntan plus 3
   procentenheter.
6. **Löneavdraget på 8 inkomstbasbelopp görs per ägare.** Två kompanjoner med 50 % var drar
   av 644 800 kr var från sin halva av lönesumman (2026). Makar som äger i samma bolag räknar
   gemensamt och gör bara ett avdrag.
7. **Två bolag, två löneavdrag.** Äger du två bolag direkt görs avdraget i varje bolag. Ligger
   bolagen under ett gemensamt holdingbolag räknas lönerna ihop och avdraget görs en gång.
8. **Holdingbolag ändrar inte skatten, bara tidpunkten.** Utdelning från dotterbolaget till
   holdingbolaget är skattefri. Skatten på 20 % (inom gränsbeloppet) kommer först när
   holdingbolaget delar ut till dig. K10 gäller aktierna i holdingbolaget.
9. **Löner i dotterbolag räknas bara om det är ett dotterföretag.** Äger ditt holdingbolag
   till exempel 25 % av ett gemensamt bolag får du inget lönebaserat utrymme från lönerna
   där.
10. **Utdelning över gränsbeloppet beskattas som lön**, men utan arbetsgivaravgifter och utan
    pensionsrätt. Över 90 inkomstbasbelopp per bolag och år blir skatten 30 %.
11. **Det går inte att flytta överskjutande utdelning till maken.** Skatten räknas som om
    utdelningen lagts ovanpå inkomsten hos den make som arbetar i bolaget.
12. **Sambo är inte alltid "make".** Sambor räknas som makar i skattereglerna bara om ni har
    eller har haft gemensamma barn, eller tidigare varit gifta med varandra.
13. **Karenstiden är fem år till och med 2026, fyra år från 2027.** Aktierna är kvalificerade
    det år du senast arbetade i bolaget och fem (från 2027 fyra) hela år därefter. Sedan
    beskattas utdelning och vinst med 25 %.
14. **Ett vilande bolag får inte väckas.** Startar du ny verksamhet i bolaget, eller flyttar
    pengar eller verksamhet mellan det och ett bolag du arbetar i, börjar karenstiden om
    eller upphör att gälla.
15. **Ett vilande bolag tar del av grundbeloppet.** Så länge aktierna är kvalificerade räknas
    bolaget med när grundbeloppet fördelas mellan dina bolag.
16. **Sparat utrymme följer aktierna, inte dig.** Det kan inte flyttas till ett annat bolag
    och försvinner när aktierna säljs till någon utomstående. Vid gåva, arv och bodelning
    tar mottagaren över det.
17. **Ränta på omkostnadsbelopp bara över 100 000 kr (från 2026).** Med 25 000 kr i
    aktiekapital ger den delen 0 kr.
18. **Lämna K10 varje år**, även utan utdelning, så att det sparade utrymmet finns
    dokumenterat.

---

## 4. Findings in the existing code

All in `js/engine.js` unless noted. Verified by calling `dividendLimit()` with the official
examples (no code changed).

**Correct**
- 2026 grundbelopp, LU for unrelated owners, ränta above 100 000 kr and the nominal
  carry-over of saved room: matches Skatteverket's Valter (limit 1 250 000), Agnes
  (LU 1 077 600), Birger (277 600), Helle (ränta 17 325).
- `ownershipInOtherCompanies` (2026): `ownership * 4 * prevIBB / Math.max(1, totalOwnership)`
  matches 57 kap. 11 a § and the official examples: Tove 25 % with 175 % elsewhere → 40 300;
  the proposition's 25 % + 100 % → 0,8 IBB = 64 480; Ismail 25 % + 33 % → not reduced.
- Use of IBB of the previous year, and all klyvningsränta values 2020–2026 in `js/params.js`
  (9,00 / 9,00 / 9,23 / 10,94 / 11,62 / 10,96 / 11,55 %), match S4.
- IY 2025 huvudregeln/förenklingsregeln for two unrelated owners: matches SKV 292's
  Axel/Ida example (104 775 and 476 200).

**Wrong or missing**

| # | Where | What | What the source says |
|---|---|---|---|
| 1 | `dividendLimit()`, 2026 branch: `0.5 * Math.min(Math.max(0, ownership*totalSalary - 8*prevIBB), 50*ownSalary)` | The 50× cap is applied before the 50 %, so the cap becomes 25 × own salary. Example: own salary 10 000, löneunderlag 3 000 000, 100 %: code gives 250 000, correct is min(1 177 600, 500 000) = 500 000 | 57 kap. 16 § 3 st.: the LU may not exceed 50 × the cash salary. Should be `Math.min(0.5 * Math.max(0, …), 50 * salary)` |
| 2 | `dividendLimit()` and `calculateCompany()`, 2026 | Spouses owning shares in the same company are treated as unrelated: two 8 IBB deductions. Amy/Gedion example: code 877 600 and 477 600; correct 1 006 560 and 671 040 | 57 kap. 16 § 2 st.; S3 |
| 3 | `dividendLimit()`, both branches | The 50× cap (and ≤ 2025 the lönekrav) only looks at `ownSalary`. A närstående's salary from the company also counts | 16 § 3 st.; S5 |
| 4 | `dividendLimit()`, ≤ 2025 branch | The 4 % kapitalandelskrav is missing. An owner with e.g. 3 % gets LU (150 000 in a test); should be 0 | S7 p. 11 |
| 5 | `dividendLimit()`, ≤ 2025 branch: `+ savedDividends` | No indexation of sparat utdelningsutrymme. Emma example (IY 2025): code 431 180, Skatteverket 437 414 (125 700 × 1,0496 = 131 934). The explanation text (`js/explanations.js`, `savedDividends`) does not say whether the user should enter the indexed amount | S5, S7; rates in 2.1 |
| 6 | `dividendLimit()`, ≤ 2025 branch | Nothing models "förenklingsregeln in only one company". `ownershipInOtherCompanies` is ignored for ≤ 2025 | S7 p. 11 |
| 7 | `dividends()` and `calculateCompany()` | LU and lönekrav use the **same** year's salary. The law uses cash wages of the year before (and IBB of the year before, which the code does use). Right only if last year's wages equal this year's | 57 kap. 17 § |
| 8 | `calculateCompany()` | `ownershipInOtherCompanies` is never passed; no input for it in the page (only used in `tests/unit/calculators.test.mjs`). A person with shares in another company gets a full grundbelopp here | 11 a § |
| 9 | `dividends()`, `calculateCompany()` | Dividends are capped at the gränsbelopp. Dividend above the limit (tjänst, 57 kap. 36 §, 90 IBB cap) cannot be modelled | 57 kap. 20, 20 a §§ |
| 10 | whole 3:12 part | No check that the shares were owned at 1 January (first year: no gränsbelopp), and no dividend possible before the first annual accounts | 11 § 4 st.; S17 |
| 11 | `dividendLimit()` return value, ≤ 2025 | `salaryBasedLimit` is returned as a positive number even when the lönekrav is not met (Axel: 462 500 shown, not usable). Display only; `huvudregeln` is right | – |
| 12 | `company()` / `calculateCompany()` | A loss gives no tax, but the loss is not carried forward. Needed once several years are modelled | 40 kap. IL |
| 13 | `js/explanations.js`, `grundbelopp` and `salaryBasedLimit` texts | Say "Från 2026: 50 % av lönesumman över 8 inkomstbasbelopp" without "din andel av" and without the spouse rule | S3 |
| 14 | `js/params.js` 2026 klyvningsränta comment | Source is a secondary site (revisionsbyran.se). Skatteverket confirms 2,55 % + 9 = 11,55 % | S3, S4 |

---

## 5. Proposed model

### 5.1 What to support first

Ranked by how common the case is among consultants and how little new math it needs.

| Rank | Structure | New math | Inputs needed |
|---|---|---|---|
| 1 | **Several years for today's single company** | Carry-over only | Per owner: sparat utdelningsutrymme at start, last year's own cash salary; per company: last year's cash wages, retained earnings, loss carried forward |
| 2 | **Person → Holding (100 %) → Driftbolag (100 %)** | Small: consolidated löneunderlag, tax-free dividend upward, koncernbidrag, holding's own costs/income | As today for the driftbolag; plus holding: other costs, capital income, how much is passed up and when; which company pays the salary |
| 3 | **Other qualified shares outside the calculation** | One number | Per person: sum of ownership (%) in other companies with qualified shares (feeds `ownershipInOtherCompanies`); ≤ 2025: "förenklingsregeln used in another company" yes/no |
| 4 | **Spouses in the same company** | Joint LU, shared cap, 36 § for excess | Relation between people in the company ("make/sambo som räknas som make" pairs) |
| 5 | **Dividend above the limit** | Tjänst tax on the excess, 90 IBB cap, 36 § | None new (remove the cap; optional switch) |
| 6 | **Two operating companies owned directly by the same person** | Grundbelopp split, LU per company, one private tax computation over both salaries | A second company with its own people list; person identity shared between companies |
| 7 | **Partners with personal holdings owning a joint driftbolag** | Dotterföretag test per holding, dividends to holdings per share | Ownership matrix company → company and person → company |
| 8 | **Trädabolag timeline** | Mostly dates and rates | Last active year, capital in the company, yearly return, planned payouts |

A general ownership graph (rank 6–7) covers 2 as a special case, but 2 alone gives most of
the value and can reuse `calculateCompany()` nearly unchanged.

### 5.2 Formulas and order of calculation, one year Y

Per **company group** (top company T directly owned by people, with subsidiaries):

1. **Operating result** per company as today (`calculateCompany` steps): revenue − costs −
   salaries − avgifter − pension → profit before tax.
2. **Koncernbidrag** (only if parent owns > 90 % the whole year): move a chosen amount of
   taxable profit between parent and subsidiary. Default: none.
3. **Bolagsskatt** per company: 20,6 % × max(0, taxable profit − loss carried forward).
   Dividends received on näringsbetingade shares are not taxable income.
4. **Dividend subsidiary → parent**: limited by the subsidiary's free equity per its last
   adopted balance sheet (profit of year Y−1 and earlier). Tax-free for the parent. See open
   question on same-year pass-through.
5. **Löneunderlag of T for year Y+1** = cash wages paid in Y in T + Σ over dotterföretag
   (wages in Y × T's share of the subsidiary × part of the year owned). Store it.

Per **person P and top company T**, for income year Y:

6. Qualified? (active in T or a company T owns, in Y or the previous 5 years; 4 from 2027.)
   If not: dividend taxed 25 %, skip 7–12.
7. Owned at 1 January Y? If not: årets gränsbelopp = 0.
8. **Grundbelopp** (Y ≥ 2026): G = 4 × IBB(Y−1). S = Σ of P's shares in all companies with
   qualified shares. g = G × s_T (if S ≤ 1) or G × s_T ÷ S (if S > 1).
   Y ≤ 2025: schablon = 2,75 × IBB(Y−1) × s_T, allowed in one company only.
9. **LU**:
   - Y ≥ 2026: base = löneunderlag(Y−1) × s; for spouses use the combined share.
     LU = 0,5 × max(0, base − 8 × IBB(Y−1)); spouses then split by share.
     LU = min(LU, 50 × highest cash salary in Y−1 of P or a närstående from T and its
     dotterföretag).
   - Y ≤ 2025: LU = 0,5 × löneunderlag(Y−1) × s, if s ≥ 4 % and salary(Y−1) of P or a
     närstående ≥ min(9,6 × IBB(Y−1), 6 × IBB(Y−1) + 5 % × all cash wages(Y−1) in T and its
     dotterföretag); same 50× cap.
10. **Ränta**: r = statslåneränta(30 Nov Y−1, min 0) + 9 pp.
    Y ≥ 2026: r × max(0, omkostnadsbelopp − 100 000). Y ≤ 2025: r × omkostnadsbelopp.
11. **Årets gränsbelopp**: Y ≥ 2026: g + LU + ränta. Y ≤ 2025: max(schablon, ränta + LU).
12. **Gränsbelopp** = årets gränsbelopp + saved_in(Y), where
    saved_in(Y) = saved_out(Y−1) × (1 + u(Y)), u = 3,00 / 3,00 / 3,23 / 4,94 / 5,62 / 4,96 %
    for 2020–2025 and 0 from 2026.
13. **Dividend** D to P (per share of T's total dividend, limited by T's free equity):
    - within = min(D, gränsbelopp) → tax 20 %.
    - excess = D − within → tjänst, up to 90 × IBB(Y) per company for P and närstående
      together; added on top of P's other earned income (if P's spouse is the active one and
      has higher taxable income, compute the tax on the excess on top of the spouse's
      income, 57 kap. 36 §). No arbetsgivaravgift.
    - above the cap → 30 %.
    - saved_out(Y) = gränsbelopp − within.
14. **Private tax**: one computation per person over salaries from all companies and other
    employers (the engine already combines `otherSalaryYear`), plus the tjänst part of 13.
15. **Sale of shares** (optional later): gain within the remaining gränsbelopp 20 %, then
    tjänst up to 100 × IBB(Y) (six-year window), then 30 %; non-qualified 25 %.

### 5.3 What carries over between years

| State | Per | Rule |
|---|---|---|
| sparat utdelningsutrymme | person × company (× share class) | step 12–13 |
| löneunderlag of year Y | top company | used in Y+1 |
| own and närstående cash salary of year Y | person × company group | cap (and lönekrav ≤ 2025) in Y+1 |
| ownership at 1 January, and changes during the year | person × company | steps 7–9; part-year ownership counts only wages paid while owned |
| omkostnadsbelopp | person × company | changes with purchases and ovillkorade aktieägartillskott |
| free equity (balanserad vinst) | company | + profit after tax − dividends; caps next year's dividend |
| loss carried forward (underskott) | company | reduces later taxable profit |
| last year active | person × company | karens: qualified through L+5 (IY ≤ 2026) / L+4 (IY ≥ 2027) |
| tjänst-taxed capital gains, last five years | närståendekrets × company | only for the 100 IBB cap on sales |
| year parameters | year | IBB(Y−1), IBB(Y), statslåneränta 30 Nov Y−1. For future years they must be assumed (see open questions) |

The first modelled year needs opening values for the first three rows; default them from
the same inputs as the first year ("same salary last year") with a visible note.

---

## 6. Test cases

### 6.1 Official worked examples

IY 2026 rules (source S3 unless noted). IBB 2025 = 80 600; ränta 11,55 %.

| # | Inputs | Expected |
|---|---|---|
| T1 Gunnar/Rita | 50 % each, one company | grundbelopp 161 200 each |
| T2 Ismail | 25 % in one company, 33 % in another | 80 600 and 106 392; not reduced |
| T3 Tove | 25 %, 75 %, 100 % in three companies | 40 300, 120 900, 161 200 (sum 322 400) |
| T4 Prop. p. 423 (S2, S8) | 25 % in X, 100 % in Y | 0,8 IBB and 3,2 IBB = 64 480 and 257 920 |
| T5 Agnes/Birger | 70 % / 30 %, not närstående; löneunderlag 2025 4 000 000; own salaries 400 000 / 300 000 | LU 1 077 600 and 277 600; caps 20 000 000 and 15 000 000 not binding |
| T6 Amy/Gedion (spouses) | 60 % / 40 %; löneunderlag 4 000 000; salaries 500 000 / 300 000 | joint LU 1 677 600; Amy 1 006 560, Gedion 671 040; cap 25 000 000 each (Amy's salary) |
| T7 Helle | 100 %, omkostnadsbelopp 250 000 | ränta 17 325 |
| T8 Valter | 100 %, omkostnadsbelopp 25 000, saved 750 000, wages 2025 1 000 000 (own 600 000), dividend 100 000 | grundbelopp 322 400; LU 177 600; ränta 0; gränsbelopp 1 250 000; tax 20 000; saved to next year 1 150 000 |
| T9 Prop. p. 425 (S2) | As T5 but IBB 76 200 | LU 1 095 200 and 295 200 (tests the formula with another IBB) |
| T10 A-/B-shares (S8) | 200 A + 300 B shares, 500 kr each, statslåneränta 2 % | ränta 0 on A; 5 500 on B |

IY 2025 rules (source S5 unless noted). IBB 2024 = 76 200; ränta 10,96 %; indexing 4,96 %.

| # | Inputs | Expected |
|---|---|---|
| T11 Rafael | 100 %, no wages, dividend 50 000 | schablon 209 550; tax 10 000 |
| T12 Harry | omkostnadsbelopp 100 000 | ränta 10 960 |
| T13 Elsa/Iben | salaries 2024: 750 000 / 350 000, total 1 100 000 | lönekrav 731 520 or 512 200; Elsa meets it, Iben does not |
| T14 Sven | wages 1 100 000, 75 % | LU 412 500 |
| T15 Leila | saved 65 000 | indexed 68 224 |
| T16 Emma | 100 %, omkostnadsbelopp 50 000, wages 2024 600 000 (own), saved 125 700, dividend 400 000 | lönekrav 487 200 met; ränta 5 480; LU 300 000; saved indexed 131 934; gränsbelopp 437 414; tax 80 000; saved to next year 37 414 |
| T17 Noah (subsidiary) | Parent wages 100 000 (to Noah). Subsidiary 60 % owned from 1 July 2024; its wages Jan–Jun 200 000, Jul–Dec 900 000 of which Noah 600 000 | lönekrav: total wages 1 000 000, own 700 000, requirement 507 200 → met; löneunderlag 100 000 + 540 000 = 640 000; LU 320 000 |
| T18 Axel/Ida (S7 p. 18) | 50 % each; cash wages 2024: Axel 250 000 (+ 40 000 bilförmån, not counted), Ida 600 000, others 1 000 000; omkostnadsbelopp 125 000 each | Axel: no LU, huvudregeln 13 700, förenklingsregeln 104 775 → 104 775. Ida: requirement 549 700 met, LU 462 500, gränsbelopp 476 200 |
| T19 Fanny (S7 p. 20) | gränsbelopp incl. indexed saved room 239 550; dividend 50 000 then sale | 189 550 of the gain at 20 % |
| T20 Sylvia (S7 p. 24) | gain 11 000 000, gränsbelopp 2 000 000, IY 2025 | 2 000 000 at 20 %; 8 060 000 tjänst; 940 000 at 30 % |
| T21 Birgitta (S6) | stopped working summer 2019 | shares non-qualified from IY 2025 |
| T22 Family (S15) | child's tjänst-taxed dividend 50 000, own income 60 000, active parent income 500 000 | statlig skatt computed on the 50 000 as if it were the parent's |

### 6.2 Existing code run against these (2026-11-12)

| Case | Code result | Status |
|---|---|---|
| T3 (Bullbageriet), T4 (X) | 40 300; 64 480 | OK |
| T5 | LU 1 077 600; 277 600 | OK |
| T6 | 877 600; 477 600 | **Wrong** (finding 2) |
| T7 | 17 325 | OK |
| T8 | 1 250 000 | OK |
| T14 | 412 500 | OK |
| T16 | 431 180 | **Wrong** by the indexation (finding 5) |
| T18 | 104 775; 476 200 | OK |
| Own test: 2026, 100 %, löneunderlag 3 000 000, own salary 10 000 | 250 000 | **Wrong**, should be 500 000 (finding 1) |
| Own test: 2025, 3 % owner, wages 10 000 000, own salary 800 000 | LU 150 000 | **Wrong**, should be 0 (finding 4) |

### 6.3 Hand-computed cases (my own arithmetic from the law text, not official)

| # | Case | Result |
|---|---|---|
| H1 | IY 2026, two unrelated owners 50/50, löneunderlag 2 000 000 | LU each 0,5 × (1 000 000 − 644 800) = 177 600; total 355 200 |
| H2 | Same but spouses | joint 0,5 × (2 000 000 − 644 800) = 677 600; 338 800 each |
| H3 | IY 2026, one person owns two companies 100 % each, wages 800 000 in each | Direct: grundbelopp 161 200 + 161 200; LU 77 600 + 77 600 = 155 200. Under one holding: grundbelopp 322 400; LU 0,5 × (1 600 000 − 644 800) = 477 600 |
| H4 | IY 2026, 100 % owner, own salary 10 000, löneunderlag 3 000 000 | LU = min(1 177 600, 500 000) = 500 000 |
| H5 | Holding 100 % → driftbolag 100 %, profit before tax 1 000 000 in driftbolag, all paid out within the gränsbelopp | bolagsskatt 206 000; dividend to holding 794 000 tax-free; dividend to owner 794 000, tax 158 800; net 635 200; total tax 36,48 % |
| H6 | Karens: last active year 2022 | qualified through 2026; non-qualified from IY 2027 (four-year rule) |
| H7 | Karens: last active year 2020 | qualified through 2025; non-qualified from IY 2026 (five-year rule) |
| H8 | Saved room 100 000 at end of 2023, no dividends | in 2024: 105 620; in 2025: 105 620 × 1,0496 = 110 858,75; in 2026: unchanged, plus the yearly amounts |
| H9 | IY 2027, single owner, no wages | årets gränsbelopp 333 600 |

---

## 7. Open questions for the owner

1. **Which structures first?** My suggestion: multi-year for the current single company,
   then Holding → Driftbolag (100/100), then "other qualified shares" as one input.
2. **Previous year's wages**: add explicit inputs for last year's löneunderlag and own
   salary (correct), or keep "same as this year" as the default with a note?
3. **Sparat utdelningsutrymme for IY ≤ 2025**: should the user enter the amount from last
   year's K10 (the calculator indexes it) or the already indexed amount? The explanation
   text must say which.
4. **Dividend above the gränsbelopp**: allow it and show the tjänst tax (needed for honest
   "take out everything" scenarios), or keep the cap?
5. **Future years in a multi-year plan**: which assumptions for IBB, statslåneränta, tax
   tables and kommun rates beyond the last known year? (E.g. freeze the last known year and
   say so, or let the user set a yearly growth.)
6. **Holding timing**: model the one-year delay of dividends through the holding, or assume
   same-year pass-through? This needs a check with an accountant (ABL rules on
   värdeöverföring, anteciperad utdelning, koncernbidrag at year-end).
7. **Holding's own economy**: include the holding's costs, capital returns and their tax
   (20,6 %), or treat the holding as an empty pass-through at first?
8. **Spouses**: only the 2026 joint LU and the shared 50× cap, or also 57 kap. 36 § (needs
   the spouse's income) and gifts of shares?
9. **Sambo without children**: show a warning only? The tax position (utomståenderegeln) is
   uncertain and should not be computed.
10. **Trädabolag**: a simple timeline (last active year → year shares become free, tax
    20 % / tjänst / 25 %) or a full simulation of capital growth and payouts?
11. **Sale of shares / liquidation**: in scope for the multi-year view or not?
12. **Brutet räkenskapsår** interacts with all of this (löneunderlag is always per calendar
    year; dividends are taxed the year of the stämma). It is already on the todo list;
    decide whether it must come before multi-year.
13. Items to verify with Skatteverket or an advisor before relying on them: saved room at an
    internal share transfer to a holding; grundavdrag on tjänst-taxed dividend; the K10 2026
    field numbers; IBB 2027 once decided.
