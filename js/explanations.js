// Explanations shown in the ⓘ popovers and in the CSV export.
// what: what the value is. formula: how the calculator computes it (or where it comes from).
// source: [link text, URL] – every URL has been checked to resolve.

const IL = 'https://lagen.nu/1999:1229';
const SKV_FAMANS = 'https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/beloppochprocentsatser.4.34f3b0b713e2cf5455b7288.html';
const SKV_312_2026 = 'https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/andradereglerinforinkomstdeklarationen2027.4.4a54dc8b19aa6175a152359.html';
const SKV_STATLIG = 'https://www.skatteverket.se/privat/etjansterochblanketter/svarpavanligafragor/inkomstavtjanst/privattjansteinkomsterfaq/narskamanbetalastatliginkomstskattochhurhogarden.5.10010ec103545f243e8000166.html';
const SKV_RAKNA = 'https://www7.skatteverket.se/portal/rakna-ut-skatt';
const SKV_AGAVG = 'https://www.skatteverket.se/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/arbetsgivaravgifter.4.233f91f71260075abe8800020817.html';

export const EXPLANATIONS = {
  year: {
    what: 'Året som beräkningen gäller. Skattesatser, belopp och regler skiljer sig mellan åren.',
    formula: 'Bolagets räkenskapsår antas vara kalenderåret.',
  },
  hourlyRate: {
    what: 'Det pris per timme du fakturerar kunden, utan moms.',
    formula: 'Anges av dig.',
  },
  assignmentName: { what: 'Ett namn på uppdraget, t.ex. kunden. Visas i kartan.', formula: 'Anges av dig.' },
  assignmentPerson: {
    what: 'Vem som arbetar i uppdraget. Personens semesterdagar dras av från de uppdrag personen arbetar i.',
    formula: 'Väljs av dig.',
  },
  personName: { what: 'Ett namn på personen. Visas i kartan och i rubrikerna.', formula: 'Anges av dig.' },
  ownership: {
    what: 'Hur stor del av aktierna personen äger. Utdelning betalas per aktie. 0 % betyder att personen bara är anställd. Är summan för alla personer under 100 % ägs resten av övriga ägare som inte ingår i kalkylen; summan får inte bli mer än 100 %.',
    formula: 'Anges av dig.',
  },
  otherOwnersShare: {
    what: 'Aktier som ägs av någon som inte är med i kalkylen. De får utdelning per aktie som alla andra, men deras gränsbelopp och skatt räknas inte, och deras gränsbelopp begränsar inte utdelningen här.',
    formula: '100 % − summan av ägarandelarna.',
  },
  otherOwnersDividends: { what: 'Den del av bolagets utdelning som går till övriga ägare. Pengarna lämnar bolaget men ingår inte i någon persons netto eller i den totala skatten.', formula: 'Utdelning från bolaget × övriga ägares andel.' },
  ownerShare: { what: 'Personens andel av aktierna, och därmed av utdelningen.', formula: 'Anges på personens kort.' },
  dividendCap: {
    what: 'Den största utdelning bolaget kan ge utan att någon ägare får mer än sitt eget gränsbelopp (så att allt beskattas med 20 %). Utdelning betalas lika per aktie, så den ägare som har lägst gränsbelopp i förhållande till sin andel sätter gränsen.',
    formula: 'Lägsta (gränsbelopp ÷ ägarandel) bland ägarna.',
    source: ['Inkomstskattelagen 57 kap. 20 §', `${IL}#K57P20`],
  },
  ownerGrossDividends: { what: 'Personens del av bolagets utdelning, före skatt.', formula: 'Utdelning totalt × ägarandel.' },
  startDate: { what: 'Första dagen du fakturerar i uppdraget.', formula: 'Anges av dig.' },
  endDate: { what: 'Sista dagen du fakturerar i uppdraget.', formula: 'Anges av dig.' },
  billingStartDate: { what: 'Första dagen du fakturerar i uppdraget.', formula: 'Anges av dig.' },
  billingEndDate: { what: 'Sista dagen du fakturerar i uppdraget.', formula: 'Anges av dig.' },
  workingRate: {
    what: 'Hur stor del av heltid du fakturerar. 100 % motsvarar 40 timmar i veckan.',
    formula: 'Anges av dig.',
  },
  vacationDays: {
    what: 'Arbetsdagar som är lediga och inte faktureras i den här perioden av uppdraget. Lämna tomt så fördelas personens 25 semesterdagar på de perioder där inget är ifyllt, efter antal arbetsdagar. Dagarna räknas också in i semesterersättningen under Lön.',
    formula: 'Anges av dig, eller beräknas: (25 − ifyllda dagar) × periodens arbetsdagar / arbetsdagar i alla perioder utan ifyllt värde.',
  },
  vacationTotal: {
    what: 'Personens semesterdagar, summan av dagarna i alla perioder i personens uppdrag. Dagarna ger semesterersättning om du tar ut den. Ändras under Uppdrag.',
    formula: 'Summan av semesterdagarna i uppdragens perioder.',
  },
  billableHours: {
    what: 'Antal timmar du kan fakturera under perioden.',
    formula: '8 × arbetstakt × (vardagar mellan start och slut som inte är röda dagar, julafton, midsommarafton eller nyårsafton − semesterdagar). Semesterdagarna fördelas över alla uppdrag efter hur många arbetsdagar de har. Med prisändringar räknas timmarna före och efter ändringen var för sig. Lämna tomt för att räkna fram, eller skriv ett eget antal.',
  },
  invoicedAmount: {
    what: 'Det du fakturerar kunden under året, utan moms. Bolagets huvudsakliga intäkt.',
    formula: 'Timpris × fakturerbara timmar.',
  },
  fromAssignment: {
    what: 'Fakturerat belopp som räknas fram i Uppdrag.',
    formula: 'Timpris × fakturerbara timmar.',
  },
  otherEmployer: { what: 'Namnet på den andra arbetsgivaren.', formula: 'Anges av dig.' },
  otherSalaryYear: {
    what: 'Lön från en annan arbetsgivare, före skatt, för hela året.',
    formula: 'Anges av dig. Beskattas tillsammans med lönen från ditt AB, så att grundavdrag, statlig skatt och jobbskatteavdrag blir rätt.',
  },
  otherIncomeTax: {
    what: 'Skatten på lönen från den andra arbetsgivaren.',
    formula: 'Skatten som den lönen skulle ha om den vore din enda inkomst. Lönen från ditt AB bär resten, alltså den extra skatt den orsakar.',
  },
  otherNetYear: { what: 'Lönen från den andra arbetsgivaren efter skatt.', formula: 'Lön brutto − skatt på den här lönen.' },
  personIncomeTax: {
    what: 'All skatt på dina löner: slutlig skatt. Stämmer på kronan mot Skatteverkets beräkning.',
    formula: 'Kommunal + statlig skatt + avgifter − skattereduktioner, på alla löner tillsammans.',
    source: ['Skatteverket: Räkna ut din skatt', SKV_RAKNA],
  },
  pensionMode: {
    what: 'Om tjänstepensionen anges som en andel av lönen eller som ett fast belopp per år.',
    formula: 'Anges av dig.',
  },
  pensionAmount: {
    what: 'Tjänstepension som bolaget betalar per år, som fast belopp.',
    formula: 'Anges av dig.',
  },
  pensionDeductible: {
    what: 'Den del av pensionskostnaden som bolaget får dra av.',
    formula: 'Högst 35 % av lönen och högst 10 prisbasbelopp (huvudregeln). Lagen tillåter även förra årets lön som underlag och har en kompletteringsregel för särskilda fall; kalkylatorn räknar med årets lön och huvudregeln.',
    source: ['Inkomstskattelagen 28 kap. 5 §', 'https://lagen.nu/1999:1229#K28P5'],
  },
  pensionNonDeductible: {
    what: 'Pensionskostnad över avdragstaket. Den ökar bolagets beskattningsbara vinst.',
    formula: 'Tjänstepension − avdragsgill del.',
    source: ['Inkomstskattelagen 28 kap. 5 §', 'https://lagen.nu/1999:1229#K28P5'],
  },
  pensionPercent: {
    what: 'Hur stor tjänstepension bolaget betalar, i procent av din bruttolön.',
    formula: 'Anges av dig; 4,7 % är kalkylatorns standardvärde. Bolagets avdrag för pensionskostnader är begränsat till 35 % av lönen och 10 prisbasbelopp; resten ökar den skattepliktiga vinsten.',
  },
  usedInvoicedAmount: {
    what: 'Det fakturerade belopp som bolaget räknar med.',
    formula: 'Hämtas från Uppdrag, eller ett eget belopp om du har valt det.',
  },
  manualInvoicedAmount: {
    what: 'Ett eget fakturerat belopp, om du inte vill räkna fram det från timpris och timmar.',
    formula: 'Anges av dig. Ersätter beloppet från Uppdrag.',
  },
  otherRevenue: { what: 'Andra intäkter i bolaget, utan moms.', formula: 'Anges av dig.' },
  yearBorn: {
    what: 'Ditt födelseår. Påverkar grundavdrag och jobbskatteavdrag (högre för äldre).',
    formula: 'Ålder vid årets början = inkomstår − födelseår − 1.',
    source: ['Inkomstskattelagen 63 kap. 3 a § (förhöjt grundavdrag)', `${IL}#K63P3a`],
  },
  kommunSelector: {
    what: 'Kommunen där du är folkbokförd den 1 november året före inkomståret. Bestämmer kommunal skatt och begravningsavgift.',
    formula: 'Skattesatser från Skatteverkets öppna data.',
  },
  churchMember: {
    what: 'Medlem i Svenska kyrkan. Då betalar du kyrkoavgift i stället för bara begravningsavgift.',
    formula: 'Anges av dig.',
    source: ['Lag om avgift till registrerat trossamfund', 'https://lagen.nu/1999:291'],
  },
  forsamlingSelector: {
    what: 'Församlingen du tillhör. Bestämmer kyrkoavgiften.',
    formula: 'Kyrkoavgift hämtas från Skatteverkets öppna data.',
  },
  useMaxGrossSalary: {
    what: 'Sätter månadslönen så att årslönen hamnar precis på brytpunkten, där statlig inkomstskatt börjar.',
    formula: 'Månadslön = brytpunkt / (månader med lön + semesterersättningens andel). Brytpunkten räknas fram ur skiktgränsen och grundavdraget.',
    source: ['Skatteverket: När betalar man statlig inkomstskatt?', SKV_STATLIG],
  },
  grossSalaryMonth: { what: 'Din lön från bolaget per månad, före skatt.', formula: 'Anges av dig.' },
  salaryMonths: { what: 'Hur många månader under året du tar ut lön.', formula: 'Anges av dig.' },
  useSemesterersattning: {
    what: 'Om du tar ut semesterersättning för dina semesterdagar, som en anställd skulle få.',
    formula: 'Anges av dig.',
  },
  grossSemesterersattning: {
    what: 'Semesterersättning (semestertillägg) före skatt.',
    formula: 'Semesterdagar × 0,43 % × månadslön brutto.',
    source: ['Semesterlagen 16 a §', 'https://lagen.nu/1977:480#P16a'],
  },
  kommunalSkattPercent: {
    what: 'Summan av kommunal skatt och regionskatt i din kommun.',
    formula: 'Från Skatteverkets öppna data för kommun och år.',
  },
  churchSkattPercent: { what: 'Kyrkoavgift i procent för din församling.', formula: 'Från Skatteverkets öppna data.' },
  burialSkattPercent: {
    what: 'Begravningsavgift i procent. Betalas av alla, oavsett medlemskap.',
    formula: 'Från Skatteverkets öppna data.',
    source: ['Begravningslagen', 'https://lagen.nu/1990:1144'],
  },
  grossSalaryYear: {
    what: 'All lön från bolaget under året, före skatt.',
    formula: 'Månadslön × månader med lön + semesterersättning.',
  },
  grundavdrag: {
    what: 'Avdrag på inkomsten innan kommunal skatt räknas. Störst för låga inkomster, och högre för äldre.',
    formula: 'Räknas med lagens formel ur prisbasbeloppet (äldre: Skatteverkets tabell). Kontrollerad mot Skatteverkets tabeller för varje 100 kr.',
    source: ['Inkomstskattelagen 63 kap. 3 §', `${IL}#K63P3`],
  },
  kommunalSkatt: {
    what: 'Skatt till kommun och region.',
    formula: 'Kommunal skattesats × (årslön avrundad nedåt till hela hundratal − grundavdrag).',
  },
  statligSkatt: {
    what: 'Statlig inkomstskatt, 20 % på den del av inkomsten som överstiger skiktgränsen.',
    formula: '20 % × max(0, beskattningsbar inkomst − skiktgräns).',
    source: ['Inkomstskattelagen 65 kap. 5 §', `${IL}#K65P5`],
  },
  churchSkatt: { what: 'Kyrkoavgift i kronor.', formula: 'Kyrkoavgift × beskattningsbar inkomst.' },
  burialSkatt: { what: 'Begravningsavgift i kronor.', formula: 'Begravningsavgift × beskattningsbar inkomst.' },
  publicServiceSkatt: {
    what: 'Avgift som finansierar SVT, SR och UR.',
    formula: '1 % av beskattningsbar inkomst, högst ett tak som bestäms varje år.',
    source: ['Lag om finansiering av radio och tv i allmänhetens tjänst', 'https://lagen.nu/2018:1893'],
  },
  jobbskatteavdrag: {
    what: 'Skattereduktion för arbetsinkomst. Minskar den kommunala skatten.',
    formula: 'Beror på inkomst, prisbasbelopp, kommunal skattesats och ålder. Högst den kommunala skatt som är kvar efter reduktionen för allmän pensionsavgift.',
    source: ['Skatteverket, rättslig vägledning: skattereduktion för arbetsinkomst', 'https://www4.skatteverket.se/rattsligvagledning/edition/2024.7/2940.html'],
  },
  skattereduktionForvarvsinkomst: {
    what: 'En mindre skattereduktion för förvärvsinkomst (från 2021).',
    formula: '0,75 % × (beskattningsbar inkomst − 40 000 kr), högst 1 500 kr, och högst den skatt som är kvar.',
  },
  incomeTax: {
    what: 'Den del av inkomstskatten som hör till lönen från ditt AB. Utan annan lön är det all inkomstskatt.',
    formula: 'Total inkomstskatt − skatt på annan lön.',
  },
  netSalaryYear: { what: 'Lön efter skatt för hela året.', formula: 'Årslön brutto − total inkomstskatt.' },
  netSemesterersattning: { what: 'Semesterersättning efter skatt.', formula: 'Semesterdagar × 0,43 % × månadslön netto.' },
  netSalaryMonth: { what: 'Lön efter skatt per månad.', formula: 'Årslön netto / (månader med lön + semesterersättningens andel).' },
  incomeTaxPercentage: { what: 'Hur stor del av lönen som går till skatt.', formula: 'Total inkomstskatt / årslön brutto.' },
  usePension: {
    what: 'Om bolaget betalar tjänstepension till dig.',
    formula: 'Anges av dig. Tjänstepension är en avdragsgill kostnad för bolaget och beskattas först när den betalas ut.',
  },
  otherCosts: { what: 'Bolagets andra kostnader, utan moms: dator, telefon, försäkringar, redovisning m.m.', formula: 'Anges av dig.' },
  pension: {
    what: 'Tjänstepension som bolaget betalar.',
    formula: 'Tjänstepension i % × årslön brutto.',
  },
  insurance: {
    what: 'Trygghetsförsäkring vid arbetsskada (TFA).',
    formula: 'Fast avgift på 200 kr per år.',
  },
  slp: {
    what: 'Särskild löneskatt på pensionskostnader, som bolaget betalar.',
    formula: '24,26 % × (tjänstepension + försäkring).',
    source: ['Lag om särskild löneskatt på pensionskostnader', 'https://lagen.nu/1990:659'],
  },
  arbetsgivaravgift: {
    what: 'Avgift som bolaget betalar ovanpå din bruttolön. Normalt 31,42 %, så att varje krona i lön kostar bolaget 1,31 kr. Lägre för äldre och ibland tillfälligt för unga.',
    formula: 'Beror på födelseår: 2026 betalas 0 % för födda 1937 eller tidigare, 10,21 % för födda 1938–1958, och för födda 2003–2007 20,81 % på lön upp till 25 000 kr/mån från april. Övriga 31,42 %.',
    source: ['Skatteverket: Arbetsgivaravgifter', SKV_AGAVG],
  },
  totalCost: {
    what: 'Bolagets alla kostnader.',
    formula: 'Övriga kostnader + årslön brutto + tjänstepension + försäkring + särskild löneskatt + arbetsgivaravgift.',
  },
  profitBeforeTax: { what: 'Bolagets vinst före bolagsskatt.', formula: 'Fakturerat belopp + övriga intäkter − totalkostnad.' },
  profitAfterTax: {
    what: 'Bolagets vinst efter bolagsskatt. En förlust ger ingen skatt tillbaka samma år.',
    formula: 'Resultat före skatt − bolagsskatt (20,6 %, 21,4 % år 2020) på en vinst.',
    source: ['Inkomstskattelagen 65 kap.', `${IL}#K65`],
  },
  omkostnadsbelopp: {
    what: 'Vad personen betalat för sina aktier, normalt sin del av aktiekapitalet (minst 25 000 kr för hela bolaget).',
    formula: 'Automatiskt: 25 000 kr × ägarandel. Avmarkera för att ange eget belopp, till exempel om aktierna köpts eller ett aktieägartillskott betalats.',
  },
  omkostnadsbeloppInterest: {
    what: 'Ränta på omkostnadsbeloppet som ökar utdelningsutrymmet.',
    formula: 'Till och med 2025: klyvningsränta × omkostnadsbelopp. Från 2026: klyvningsränta × den del som överstiger 100 000 kr.',
    source: ['Skatteverket: Belopp och procentsatser för fåmansföretag', SKV_FAMANS],
  },
  salaryBasedLimit: {
    what: 'Utdelningsutrymme som beror på lönerna i bolaget.',
    formula: 'Till och med 2025: 50 % av lönesumman, om löneuttagskravet är uppfyllt. Från 2026: 50 % av lönesumman över 8 inkomstbasbelopp.',
    source: ['Skatteverket: Ändrade regler för fåmansföretag', SKV_312_2026],
  },
  dividendsLimitForenklingsregeln: {
    what: 'Schablonbeloppet enligt förenklingsregeln (till och med 2025).',
    formula: '2,75 × föregående års inkomstbasbelopp.',
    source: ['Skatteverket: Belopp och procentsatser för fåmansföretag', SKV_FAMANS],
  },
  dividendsLimitHuvudregeln: {
    what: 'Utdelningsutrymmet enligt huvudregeln (till och med 2025).',
    formula: 'Ränta på omkostnadsbelopp + lönebaserat utrymme (högst 50 × din lön).',
    source: ['Skatteverket: Belopp och procentsatser för fåmansföretag', SKV_FAMANS],
  },
  grundbelopp: {
    what: 'Grundbelopp enligt 2026 års regler. Bolagets grundbelopp fördelas lika per aktie, så en ägare med 50 % får halva. En person får högst ett helt grundbelopp sammanlagt för alla bolag.',
    formula: 'Ägarandel × 4 × föregående års inkomstbasbelopp.',
    source: ['Skatteverket: Ändrade regler för fåmansföretag', SKV_312_2026],
  },
  savedDividends: {
    what: 'Utdelningsutrymme som du inte använt tidigare år och som får sparas.',
    formula: 'Anges av dig.',
  },
  dividendsLimit: {
    what: 'Gränsbeloppet: hur mycket utdelning du kan ta ut med 20 % skatt.',
    formula: 'Till och med 2025: max(förenklingsregeln, huvudregeln) + sparat. Från 2026: grundbelopp + lönebaserat utrymme + ränta på omkostnadsbelopp + sparat.',
    source: ['Inkomstskattelagen 57 kap. 11 §', `${IL}#K57P11`],
  },
  maxDividend: {
    what: 'Tar ut så mycket utdelning som både gränsbeloppet och bolagets vinst tillåter.',
    formula: 'Utdelning = min(utdelningsgräns, resultat efter skatt). Med flera ägare används den största utdelningen där ingen ägare går över sitt gränsbelopp.',
  },
  grossDividends: { what: 'Utdelning före skatt.', formula: 'Anges av dig, eller maximal utdelning.' },
  netDividends: {
    what: 'Utdelning efter skatt. Betalas ut året efter.',
    formula: 'Utdelning × 80 % (20 % skatt inom gränsbeloppet).',
    source: ['Inkomstskattelagen 57 kap. 20 §', `${IL}#K57P20`],
  },
  profitAfterDividends: { what: 'Det som blir kvar i bolaget efter utdelningen.', formula: 'Resultat efter skatt − utdelning.' },
  netSumMonth: {
    what: 'Vad du får ut per månad: lön efter skatt plus utdelning efter skatt.',
    formula: 'Månadslön netto + årsutdelning netto / månader med lön + annan lön netto / 12.',
  },
  totalTax: {
    what: 'All skatt på det du tar ut, utom bolagsskatten på vinst som blir kvar i bolaget.',
    formula: 'Inkomstskatt + särskild löneskatt + arbetsgivaravgift + bolagsskatt på utdelad vinst + skatt på utdelning.',
  },
  bolagsTaxExclDividends: {
    what: 'Bolagsskatt på den vinst som blir kvar i bolaget.',
    formula: 'Årets resultat efter utdelning × 20,6 / 79,4.',
  },
  totalTaxPercentage: {
    what: 'Hur stor del av bolagets intäkter som går till skatt.',
    formula: 'Total skatt / (fakturerat belopp + övriga intäkter).',
  },
};
