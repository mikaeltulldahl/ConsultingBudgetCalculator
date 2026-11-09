// Tax parameters per income year. Adding a new year should normally only require adding
// a block here (plus kommun rates), unless a rule changes structure.
//
// Main sources:
//  - Belopp och procentsatser för fåmansföretag:
//    https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/beloppochprocentsatser.4.34f3b0b713e2cf5455b7288.html
//  - Regeringens beräkningskonventioner (jobbskatteavdrag coefficients).
//  - Skatteverket: När ska man betala statlig inkomstskatt (skiktgräns / brytpunkt).
//
// Skiktgräns, grundavdrag and the private tax rules are verified against Skatteverket's
// own calculator in tests/correctness/skatteverket.test.mjs.

export const YEARS = {
  2020: {
    prisbasbelopp: 47300,
    inkomstbasbelopp: 66800,
    skiktgrans: 509300, // was 523200 (the brytpunkt) before verification against Skatteverket
    // Brytpunkt (where statlig skatt starts) is computed from skiktgräns and grundavdrag.
    publicServiceMax: 1397,
    // [k1, k2, k3, k4, old_rate_low, old_rate_mid, old_flat, phase_out_rate, age_limit]
    // https://www4.skatteverket.se/rattsligvagledning/edition/2024.7/2940.html
    jobbskatteavdrag: [0.3405, 1.703, 0.1280, 2.323, 0.20, 0.05, 30000, 0.03, 65],
    klyvningsranta: 0.0900,
    // Förhöjt grundavdrag from this age (age at the start of the year).
    forhojtGrundavdragAge: 65,
    skattereduktionForvarvsinkomst: false, // introduced 2021
    tillfalligSkattereduktionArbetsinkomster: false,
  },
  2021: {
    prisbasbelopp: 47600,
    inkomstbasbelopp: 68200,
    skiktgrans: 523200, // was 537200 (the brytpunkt) before verification against Skatteverket
    publicServiceMax: 1329,
    jobbskatteavdrag: [0.3405, 1.703, 0.1280, 2.323, 0.20, 0.05, 30000, 0.03, 65],
    klyvningsranta: 0.0900,
    forhojtGrundavdragAge: 65,
    skattereduktionForvarvsinkomst: true,
    // Lag (2021:930) om tillfällig skattereduktion för arbetsinkomster, 2021-2022 only.
    tillfalligSkattereduktionArbetsinkomster: true,
  },
  2022: {
    prisbasbelopp: 48300,
    inkomstbasbelopp: 71000,
    skiktgrans: 540700, // was 554900 (the brytpunkt) before verification against Skatteverket
    publicServiceMax: 1327,
    jobbskatteavdrag: [0.3874, 1.812, 0.1280, 2.432, 0.20, 0.05, 30000, 0.03, 65],
    klyvningsranta: 0.0923,
    forhojtGrundavdragAge: 65,
    skattereduktionForvarvsinkomst: true,
    // Lag (2021:930) om tillfällig skattereduktion för arbetsinkomster, 2021-2022 only.
    tillfalligSkattereduktionArbetsinkomster: true,
  },
  2023: {
    prisbasbelopp: 52500,
    inkomstbasbelopp: 74300,
    skiktgrans: 598500, // was 613900 (the brytpunkt) before verification against Skatteverket
    publicServiceMax: 1300,
    jobbskatteavdrag: [0.3874, 1.812, 0.1280, 2.432, 0.22, 0.07, 36000, 0.03, 65],
    klyvningsranta: 0.1094,
    forhojtGrundavdragAge: 66,
    skattereduktionForvarvsinkomst: true,
    tillfalligSkattereduktionArbetsinkomster: false,
  },
  2024: {
    prisbasbelopp: 57300,
    inkomstbasbelopp: 76200,
    skiktgrans: 598500,
    publicServiceMax: 1219,
    jobbskatteavdrag: [0.3874, 1.813, 0.1643, 2.608, 0, 0, 0, 0.03, 66],
    klyvningsranta: 0.1162,
    forhojtGrundavdragAge: 66,
    skattereduktionForvarvsinkomst: true,
    tillfalligSkattereduktionArbetsinkomster: false,
  },
  2025: {
    prisbasbelopp: 58800,
    inkomstbasbelopp: 80600,
    // https://www.skatteverket.se/privat/etjansterochblanketter/svarpavanligafragor/inkomstavtjanst/privattjansteinkomsterfaq/narskamanbetalastatliginkomstskattochhurhogarden.5.10010ec103545f243e8000166.html
    skiktgrans: 625800,
    publicServiceMax: 1249,
    // page 41: https://www.regeringen.se/contentassets/0229ac516d4241e5a7b3dbf8e2d6b5a3/berakningskonventioner-2025.pdf
    jobbskatteavdrag: [0.3874, 1.813, 0.199, 2.776, 0, 0, 0, 0, 66],
    klyvningsranta: 0.1096,
    forhojtGrundavdragAge: 66,
    skattereduktionForvarvsinkomst: true,
    tillfalligSkattereduktionArbetsinkomster: false,
  },
  2026: {
    prisbasbelopp: 59200,
    inkomstbasbelopp: 83400,
    skiktgrans: 643000,
    publicServiceMax: 1184,
    // page 42: https://www.regeringen.se/contentassets/1ed01e00001b42e5ad8d47433db63ece/berakningskonventioner_2026.pdf
    jobbskatteavdrag: [0.3874, 1.813, 0.251, 3.027, 0, 0, 0, 0, 66],
    // From 2026 only applied to omkostnadsbelopp above 100 000 kr.
    // https://revisionsbyran.se/statslanerantan-30-11-2025/
    klyvningsranta: 0.1155,
    forhojtGrundavdragAge: 66,
    skattereduktionForvarvsinkomst: true,
    tillfalligSkattereduktionArbetsinkomster: false,
  },
};

// Inkomstbasbelopp for years before the first supported year, needed because the
// dividend rules use the previous year's value.
const EXTRA_INKOMSTBASBELOPP = { 2019: 64400 };

// Rates that have been the same for all supported years (as modelled by this calculator).
export const RATES = {
  arbetsgivaravgift: 0.3142,
  sarskildLoneskatt: 0.2426, // SLP on pension premiums
  bolagsskatt: 0.206,
  dividendTax: 0.2, // kapitalinkomstskatt on dividends within the gränsbelopp: 2/3 * 30 %
  statligSkatt: 0.2,
  pensionPremium: 0.047, // tjänstepension as share of gross salary (assumption, ITP1-like)
  semesterersattningPerDay: 0.0043,
  arbetsskadeforsakring: 200, // flat fee per year (Fora); verksamt.se uses 0.3 % of salary
  allmanPensionsavgift: 0.07,
  allmanPensionsavgiftCapIbb: 8.07,
  allmanPensionsavgiftFloorPbb: 0.423,
  // https://data.riksdagen.se/dokument/sfs-1994-1744.html: rounded to the nearest hundred,
  // amounts ending in exactly 50 are rounded down.
  publicServiceRate: 0.01,
  skattereduktionForvarvsinkomst: { threshold: 40000, rate: 0.0075, max: 1500 },
};

export const FIRST_YEAR = Math.min(...Object.keys(YEARS).map(Number));
export const LAST_YEAR = Math.max(...Object.keys(YEARS).map(Number));

export class UnsupportedYearError extends Error {
  constructor(year) {
    super(`Inkomstår ${year} stöds inte (${FIRST_YEAR}–${LAST_YEAR}).`);
    this.name = 'UnsupportedYearError';
    this.year = year;
  }
}

export function getYearParams(year) {
  const p = YEARS[year];
  if (!p) throw new UnsupportedYearError(year);
  return p;
}

export function getInkomstbasbelopp(year) {
  return YEARS[year]?.inkomstbasbelopp ?? EXTRA_INKOMSTBASBELOPP[year];
}
