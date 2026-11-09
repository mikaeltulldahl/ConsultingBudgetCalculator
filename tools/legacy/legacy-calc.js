// FROZEN COPY of the calculation code in index.html at commit b56547f (lines 772-1120 and 1437-1553).
// Do not edit. Used only by tools/generate-legacy-snapshot.mjs as the reference for the refactor.
    async function updateSalary(fields){
      if(isNaN(fields.kommunalSkattPercent) || isNaN(fields.churchSkattPercent) || isNaN(fields.burialSkattPercent) || isNaN(fields.age) || fields.age < 0 || fields.age > 150){
        return;
      }
      fields.vacationMonths = fields.useSemesterersattning ? 0.0043*fields.vacationDays : 0;
      let monthMultiplier = fields.vacationMonths + fields.salaryMonths;
      // Calculate max gross salary if checkbox is checked
      if(useMaxGrossSalaryCheckbox.checked) {
        let brytpunkt = getBrytpunktStatligSkatt(fields.year, fields.age);
        if(isNaN(brytpunkt)) {
          return;
        }
        fields.grossSalaryMonth = Math.floor(brytpunkt / monthMultiplier);        
      }
      fields.grossSemesterersattning = Math.floor(fields.vacationMonths*fields.grossSalaryMonth);
      fields.grossSalaryYear  = Math.floor(monthMultiplier*fields.grossSalaryMonth);
      fields.grossSalaryYearRough = Math.floor(fields.grossSalaryYear/100)*100;
      
      await updateGrundavdrag(fields);
      if(isNaN(fields.grundavdrag)){
        return;
      }
      fields.taxableIncome = fields.grossSalaryYearRough - fields.grundavdrag;
      fields.kommunalSkatt = Math.floor(fields.kommunalSkattPercent*fields.taxableIncome);
      fields.statligSkatt = Math.floor(0.2*Math.max(0, fields.taxableIncome - getSkiktgrans(fields.year)));
      fields.burialSkatt = Math.floor(fields.burialSkattPercent*fields.taxableIncome);
      fields.churchSkatt = Math.floor(fields.churchSkattPercent*fields.taxableIncome);
      fields.publicServiceSkatt = getPublicServiceSkatt(fields);
      
      fields.currentIBB = getInkomstbasbelopp(fields.year);
      fields.prevIBB = getInkomstbasbelopp(fields.year - 1) || fields.currentIBB;
       // source https://www4.skatteverket.se/rattsligvagledning/edition/2024.7/1348.html
      if (fields.grossSalaryYearRough < 0.423 * getPrisbasbelopp(fields.year)){
        fields.allmanPensionsAvgift = 0;
      }else{
        fields.allmanPensionsAvgift = 0.07*Math.min(fields.grossSalaryYearRough, 8.07*fields.currentIBB); 
        fields.allmanPensionsAvgift = Math.floor(fields.allmanPensionsAvgift/100)*100;
      }
      let skattereduktionAllmanPensionsAvgift = fields.allmanPensionsAvgift;
      fields.jobbskatteavdrag = Math.min(getJobbskatteavdrag(fields), fields.kommunalSkatt - skattereduktionAllmanPensionsAvgift); 
      fields.skattereduktionForvarvsinkomst = getSkattereduktionForvarvsinkomst(fields.taxableIncome);
      fields.incomeTax = fields.kommunalSkatt + fields.statligSkatt + fields.burialSkatt + fields.churchSkatt + fields.publicServiceSkatt - fields.jobbskatteavdrag - fields.skattereduktionForvarvsinkomst;
      if(fields.incomeTax < 0){
        fields.jobbskatteavdrag += fields.incomeTax;
        fields.incomeTax = 0;
      }
      fields.netSalaryYear = fields.grossSalaryYear - fields.incomeTax;
      fields.netSalaryMonth = salaryMonths? fields.netSalaryYear/monthMultiplier : 0;
      fields.netSemesterersattning = fields.vacationMonths*fields.netSalaryMonth;
      fields.incomeTaxPercentage = 100*fields.incomeTax / fields.grossSalaryYear;
    }


    function getPublicServiceSkatt(fields){
      let params =  { 2019:1347,
                      2020:1397,
                      2021:1329,
                      2022:1327,
                      2023:1300,
                      2024:1219,
                      2025:1249,
                      2026:1184};
      return Math.min(params[fields.year], Math.floor(0.01*fields.taxableIncome));
    }

    function getSkattereduktionForvarvsinkomst(taxableIncome){
      if(taxableIncome <= 40000){
        return 0;
      }
      return Math.floor(Math.min(1500, 0.0075 * (taxableIncome - 40000)));
    }

    var grundavdragCache = [null, null];
    async function updateGrundavdrag(fields){
      let idx = fields.age < 66 ? 0 : 1;
      let url = "";
      if(idx){
        url = `https://skatteverket.entryscape.net/rowstore/dataset/43902bf8-cb34-4288-ab95-2080f8a878dc?%C3%A5r=${fields.year}`;
      }else{
        url = `https://skatteverket.entryscape.net/rowstore/dataset/ebbd8d70-9b9c-4327-b2ce-a371ee66744c?%C3%A5r=${fields.year}`;
      }
      if(!grundavdragCache[idx]){
        await updateCache(url);
      }

      async function updateCache(){
        grundavdragCache[idx] = [];
        let offset = 0;
        let done = false;
        while(!done){
          await fetch(`${url}&_limit=500&_offset=${offset}`, { headers: {'Accept': 'application/json'}})
            .then(response => response.json())
            .then(data => {
              grundavdragCache[idx].push(...data.results)
            });
            offset+=500;
            if(grundavdragCache[idx].length < offset){
              done = true;
            }
        }
      }

      const minSalary = getMinSalary();
      if(fields.grossSalaryYearRough <= minSalary){
        fields.grundavdrag = fields.grossSalaryYearRough;
        return;
      }
      const [maxSalaryGrundavdrag, maxSalary] = getMaxSalary();
      if(fields.grossSalaryYearRough >= maxSalary){
        fields.grundavdrag = maxSalaryGrundavdrag;
        return;
      }
      fields.grundavdrag = getMiddleSalary();
      
      function getMinSalary(){
        return parseInt(grundavdragCache[idx][0]['ink tom']);
      }

      function getMaxSalary(){
        let lastElement = grundavdragCache[idx][grundavdragCache[idx].length-1];
        return [parseInt(lastElement['gr avdrag']), parseInt(lastElement['ink from'])]
      }
      
      function getMiddleSalary(){
        for (let i = 1; i < grundavdragCache[idx].length-1; i++) {
          const entry = grundavdragCache[idx][i];
          if ( fields.grossSalaryYearRough >= parseInt(entry['ink from']) && 
               fields.grossSalaryYearRough <= parseInt(entry['ink tom'])){
            return parseInt(entry['gr avdrag']);
          }
        }
        return NaN;
      }
    }

    function getJobbskatteavdrag(fields){
      // source: https://www4.skatteverket.se/rattsligvagledning/edition/2024.7/2940.html
      let pbb = getPrisbasbelopp(fields.year);
      let ratio = fields.grossSalaryYearRough/pbb;
      let params =  { 2019:[0.3405, 1.703, 0.1280, 2.323, 0.20, 0.05, 30000, 0.03, 65],
                      2020:[0.3405, 1.703, 0.1280, 2.323, 0.20, 0.05, 30000, 0.03, 65],
                      2021:[0.3405, 1.703, 0.1280, 2.323, 0.20, 0.05, 30000, 0.03, 65],
                      2022:[0.3874, 1.812, 0.1280, 2.432, 0.20, 0.05, 30000, 0.03, 65],
                      2023:[0.3874, 1.812, 0.1280, 2.432, 0.22, 0.07, 36000, 0.03, 65],
                      2024:[0.3874, 1.813, 0.1643, 2.608, 0, 0, 0, 0.03, 66],
                      2025:[0.3874, 1.813, 0.199, 2.776, 0, 0, 0, 0, 66], // source page 41: https://www.regeringen.se/contentassets/0229ac516d4241e5a7b3dbf8e2d6b5a3/berakningskonventioner-2025.pdf
                      2026:[0.3874, 1.813, 0.251, 3.027, 0, 0, 0, 0, 66],}; // source page 42: https://www.regeringen.se/contentassets/1ed01e00001b42e5ad8d47433db63ece/berakningskonventioner_2026.pdf
      if(fields.age < params[fields.year][8]){
        if(ratio < 0.91){
          return Math.floor((fields.grossSalaryYearRough - fields.grundavdrag)*fields.kommunalSkattPercent);
        }
        if(ratio < 3.24){
          return Math.floor(((0.91*pbb + params[fields.year][0]*(fields.grossSalaryYearRough - 0.91*pbb)) - fields.grundavdrag) * fields.kommunalSkattPercent);
        }
        if(ratio < 8.08){
          return Math.floor(((params[fields.year][1]*pbb + params[fields.year][2]*(fields.grossSalaryYearRough - 3.24*pbb)) - fields.grundavdrag) * fields.kommunalSkattPercent);
        }
        if(ratio < 13.54){
          return Math.floor((params[fields.year][3]*pbb - fields.grundavdrag) * fields.kommunalSkattPercent);
        }
        return Math.floor((params[fields.year][3]*pbb - fields.grundavdrag) * fields.kommunalSkattPercent - params[fields.year][7]*(fields.grossSalaryYearRough - 13.54*pbb));
      }else{ // Jobbskatteavdrag för äldre
        if (fields.year >= 2024){
          if (ratio <= 1.75) {
            return Math.floor(0.22 * fields.grossSalaryYearRough);
          }
          if (ratio <= 5.24) {
            return Math.floor((0.2635*pbb) + (0.07*fields.grossSalaryYearRough));
          }
          if (ratio <= 10.48) {
            return Math.floor(0.6293*pbb);
          }
          return Math.floor(Math.max(0, (0.6293*pbb) - params[fields.year][7]*(fields.grossSalaryYearRough - 10.48*pbb)));
        } else {
          if(fields.grossSalaryYearRough <= 100000){
            return Math.floor(params[fields.year][4]*fields.grossSalaryYearRough);
          }
          if(fields.grossSalaryYearRough <= 300000){
            return Math.floor(15000 + params[fields.year][5]*fields.grossSalaryYearRough);
          }
          if(fields.grossSalaryYearRough <= 600000){
            return Math.floor(params[fields.year][6]);
          }
          return Math.floor(Math.max(0, params[fields.year][6] - 0.03*(fields.grossSalaryYearRough - 600000)));
        }
      }
    }

    // source for a lot of these values:
    // https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/beloppochprocentsatser.4.34f3b0b713e2cf5455b7288.html
    function getPrisbasbelopp(year){
      let values = {2020:47300,
                    2021:47600,
                    2022:48300,
                    2023:52500,
                    2024:57300,
                    2025:58800,
                    2026:59200};
      return values[year];
    }

    function getInkomstbasbelopp(year){
      let values = {2019:64400,
                    2020:66800,
                    2021:68200,
                    2022:71000,
                    2023:74300,
                    2024:76200,
                    2025:80600,
                    2026:83400};
      return values[year];
    }
     
    function getBrytpunktStatligSkatt(year, age){
      let values = {2019:{young:504400, old:629600}, // source year 2019 - 2024:  https://www.spiris.se/blogg/skatter/inkomstskatt
                    2020:{young:523200, old:575500},
                    2021:{young:537200, old:596800},
                    2022:{young:554900, old:618700},
                    2023:{young:613900, old:683200},
                    2024:{young:615300, old:697300},
                    2025:{young:643100, old:733200}, // source year 2025 - 2026: https://www.skatteverket.se/privat/etjansterochblanketter/svarpavanligafragor/inkomstavtjanst/privattjansteinkomsterfaq/narskamanbetalastatliginkomstskattochhurhogarden.5.10010ec103545f243e8000166.html
                    2026:{young:660400, old:760500}}; 
      return age >= 66 ? values[year].old : values[year].young;
    }

    function getSkiktgrans(year){
      let values = {2020:523200,
                    2021:537200,
                    2022:554900,
                    2023:613900,
                    2024:598500,
                    2025:625800,
                    2026:643000};
      return values[year];
    }

    function updateResultat(fields){
      if(isNaN(fields.otherCosts) || isNaN(fields.grossSalaryYear) || isNaN(fields.otherRevenue) || isNaN(fields.invoicedAmount)){
        return;
      }
      fields.pension = fields.usePension ? 0.047*fields.grossSalaryYear : 0;
      fields.insurance = 200;// verksamt.se räknar med 0.003*grossSalaryYear men fora tar fast 200 kr avgift
      fields.slp = 0.2426*(fields.pension + fields.insurance);
      fields.arbetsgivaravgift = 0.3142*fields.grossSalaryYear;
      fields.totalCost = fields.otherCosts + fields.grossSalaryYear + fields.pension + fields.insurance + fields.slp + fields.arbetsgivaravgift;
      fields.profitBeforeTax = fields.invoicedAmount + fields.otherRevenue - fields.totalCost;
      fields.profitAfterTax = fields.profitBeforeTax*(1-0.206);
    }

    maxDividendCheckbox.addEventListener('change', function() {
      grossDividendsField.disabled = this.checked;
    });

    useMaxGrossSalaryCheckbox.addEventListener('change', function() {
      grossSalaryMonthField.disabled = this.checked;
    });

    function updateDividends(fields){
      // assumptions:
      // - bolagsform: aktiebolag
      // - uppfyller regler för fåmansföretag
      // - du äger 100% av aktierna
      // - du är enda anställda i bolaget
      // - du har inte lön från andra källor
      // - du äger inte kvalificerade aktier i andra bolag (du är ej verksam i betydande omfattning andra fåmansföretag)

      if(isNaN(fields.grossSalaryYear) || isNaN(fields.profitAfterTax) || isNaN(fields.savedDividends) || isNaN(fields.omkostnadsbelopp)){
        return;
      }

      let stockOwnerPercentage = 1; // TODO read from input field
      if (stockOwnerPercentage <= 0 || stockOwnerPercentage > 1){ // prevent invalid input
        return;
      }

      let stockOwnerShipInOtherCompanies = 0; // TODO read from input field
      let totalStockOwnership = stockOwnerPercentage + stockOwnerShipInOtherCompanies; // i.e. I own 50% of this company and 30% of another company => totalStockOwnership = 0.8
      let klyvningsRanta =  { 2019:0.0951,
                              2020:0.0900,
                              2021:0.0900,
                              2022:0.0923,
                              2023:0.1094,
                              2024:0.1162,
                              2025:0.1096,
                              2026:0.1155};
      
      let totalSalary = fields.grossSalaryYear; // TODO sum from all employees
      // the dividend rules are based on the previous year's IBB
      if (fields.year <= 2025) {
        let canUseSalaryBase = fields.grossSalaryYear >= 9.60*fields.prevIBB || fields.grossSalaryYear >= (6*fields.prevIBB + 0.05*totalSalary);
        fields.salaryBasedLimit = stockOwnerPercentage*0.5*totalSalary;
        fields.dividendsLimitForenklingsregeln = stockOwnerPercentage*2.75*fields.prevIBB;
        fields.omkostnadsbeloppInterest = klyvningsRanta[fields.year]*fields.omkostnadsbelopp;
        fields.dividendsLimitHuvudregeln = fields.omkostnadsbeloppInterest + canUseSalaryBase*Math.min(fields.salaryBasedLimit, 50*fields.grossSalaryYear);
        fields.dividendsLimit = Math.floor(Math.max(fields.dividendsLimitForenklingsregeln, fields.dividendsLimitHuvudregeln)) + fields.savedDividends;
      } else { // year 2026
        // after 2026, klyvningsRanta works differently https://revisionsbyran.se/statslanerantan-30-11-2025/#:~:text=Klyvningsr%C3%A4nta%20p%C3%A5%20belopp%20%3E%20100%20000%20kr 
        // after 2026, dividends limit rules have changed: https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/andradereglerinforinkomstdeklarationen2027.4.4a54dc8b19aa6175a152359.html
        // source used for most of these calculations https://youtu.be/m6xlQ2f1EEk?si=pZfeql7cWZPBI5SK
          fields.dividendsLimitForenklingsregeln = NaN; // not applicable anymore
          fields.dividendsLimitHuvudregeln = NaN; // not applicable anymore
          fields.grundbelopp = stockOwnerPercentage / Math.min(1, totalStockOwnership) * 4 * fields.prevIBB;
          fields.salaryBasedLimit = 0.5 * Math.min(Math.max(0, stockOwnerPercentage*totalSalary - 8*fields.prevIBB), 50*fields.grossSalaryYear);
          fields.omkostnadsbeloppInterest = klyvningsRanta[fields.year]*Math.max(0, fields.omkostnadsbelopp - 100000);
          fields.dividendsLimit = Math.floor(fields.omkostnadsbeloppInterest + fields.grundbelopp + fields.salaryBasedLimit) + fields.savedDividends;
      }
      if(maxDividendCheckbox.checked){
        fields.grossDividends = Math.max(0, Math.min(fields.dividendsLimit, fields.profitAfterTax));
      }else if(fields.grossDividends > fields.dividendsLimit){
        fields.grossDividends = fields.dividendsLimit;
      }
      fields.netDividends = fields.grossDividends*(1-0.2);
      fields.profitAfterDividends = fields.profitAfterTax - fields.grossDividends;
    }

    function updateConclusion(fields){
      if( isNaN(fields.incomeTax) || 
          isNaN(fields.slp) ||
          isNaN(fields.arbetsgivaravgift) ||
          isNaN(fields.grossDividends) ||
          isNaN(fields.netSalaryMonth) ||
          isNaN(fields.netDividends) ||
          isNaN(fields.salaryMonths) ||
          isNaN(fields.profitBeforeTax) ||
          isNaN(fields.otherRevenue) ||
          isNaN(fields.invoicedAmount)){
        return;
      }

      if(fields.profitBeforeTax > 0){
        fields.bolagsTax = fields.profitBeforeTax*0.206;

        // bolagsskatt on profit which was paid out as dividends
        fields.bolagsTaxOnDividends = fields.grossDividends * 0.206 / (1- 0.206);
        
        // bolagsskatt on profit which was not paid out as dividends
        fields.bolagsTaxExclDividends = fields.profitAfterDividends * 0.206 / (1- 0.206);
      }else{
        fields.bolagsTax = 0;
        fields.bolagsTaxOnDividends = 0;
        fields.bolagsTaxExclDividends = 0;
      }

      fields.dividendTax = 0.2*fields.grossDividends;
      fields.totalTax = fields.incomeTax + fields.slp + fields.arbetsgivaravgift + fields.bolagsTaxOnDividends + fields.dividendTax;
      // I decided dividends should not be distributed over Semesterersättning, only on regular salary
      fields.netSumMonth = fields.netSalaryMonth + fields.netDividends/fields.salaryMonths;
      fields.totalTaxPercentage = 100*fields.totalTax/(fields.invoicedAmount + fields.otherRevenue);
    }
    const arrayRange = (start, stop, step) =>
      Array.from(
      { length: (stop - start) / step + 1 },
      (value, index) => start + index * step
      );

    async function updateChart(fields){
      if(totalTaxPercentageField.value.length == 0){
        // reset chart
        chartData.labels = [];
        chartData.datasets[0].data = [];
        chartData.datasets[1].data = [];
        chartData.datasets[2].data = [];
        chartData.datasets[3].data = [];
        chartData.datasets[4].data = [];
        chartData.datasets[5].data = [];
        chartData.datasets[6].data = [];
        myChart.update();

        percentageChartData.labels = [];
        percentageChartData.datasets[0].data = [];
        percentageChartData.datasets[1].data = [];
        percentageChartData.datasets[2].data = [];
        percentageChart.update();
        return;
      }
      let totalRevenue = fields.invoicedAmount + fields.otherRevenue - fields.otherCosts
      let probableMaxGrossSalary = 10000 + totalRevenue/(1 + 0.3142 + 0.047 * (1 + 0.2426));
      grossSalaryRange = arrayRange(0, probableMaxGrossSalary, 500);
      netSalaryYearRange = new Array(grossSalaryRange.length);
      netDividendsRange = new Array(grossSalaryRange.length);
      pensionRange = new Array(grossSalaryRange.length);
      profitAfterDividendsRange = new Array(grossSalaryRange.length);
      totalTaxRange = new Array(grossSalaryRange.length);
      bolagsTaxExclDividendsRange = new Array(grossSalaryRange.length);
      maxSumXY = {x: 0, y: 0};
      minTaxXY = {x: 0, y: 10000};

      taxPercentageRange = new Array(grossSalaryRange.length);
      marginalTaxPercentageRange = new Array(grossSalaryRange.length);

      let prevTotalTax = 0;
      let prevGrossSumYear = 0;
      
      for (i in grossSalaryRange) {
        let fieldsClone = { ...fields }
        fieldsClone.grossSalaryMonth = grossSalaryRange[i];
        await updateSalary(fieldsClone);
        updateResultat(fieldsClone);
        updateDividends(fieldsClone);
        updateConclusion(fieldsClone);
        if(fieldsClone.profitAfterDividends < 0){
          grossSalaryRange.length = i;
          netSalaryYearRange.length = i;
          netDividendsRange.length = i;
          pensionRange.length = i;
          profitAfterDividendsRange.length = i;
          totalTaxRange.length = i;
          bolagsTaxExclDividendsRange.length = i;

          taxPercentageRange.length = i;
          marginalTaxPercentageRange.length = Math.min(marginalTaxPercentageRange.length,i);
          break;
        }
        netSalaryYearRange[i] = fieldsClone.netSalaryYear.toFixed();
        netDividendsRange[i] = fieldsClone.netDividends.toFixed();
        pensionRange[i] = fieldsClone.pension.toFixed();
        profitAfterDividendsRange[i] = fieldsClone.profitAfterDividends.toFixed();
        totalTaxRange[i] = fieldsClone.totalTax.toFixed();
        bolagsTaxExclDividendsRange[i] = fieldsClone.bolagsTaxExclDividends.toFixed();
        let netSumYear = fieldsClone.netSalaryYear + fieldsClone.netDividends;
        if(netSumYear > maxSumXY.y){
          maxSumXY.x = fieldsClone.grossSalaryMonth;
          maxSumXY.y = netSumYear.toFixed();
        }

        let grossSumYear = fieldsClone.grossSalaryYear + fieldsClone.grossDividends;
        let taxPercentage = 100*fieldsClone.totalTax/grossSumYear;
        taxPercentageRange[i] = taxPercentage.toFixed(2);

        if(taxPercentage < minTaxXY.y){
          minTaxXY.x = fieldsClone.grossSalaryMonth;
          minTaxXY.y = taxPercentageRange[i];
        }
        
        if (i == 0){
          marginalTaxPercentageRange[0] = 0;
        }else if(i < marginalTaxPercentageRange.length){
          let taxDiff = fieldsClone.totalTax - prevTotalTax;
          let totalDiff = grossSumYear-prevGrossSumYear;
          if(totalDiff <= 0){
            marginalTaxPercentageRange.length = i;
          }else{
            marginalTaxPercentageRange[i] = (100*taxDiff/totalDiff).toFixed(2);
          }
        }
        prevTotalTax = fieldsClone.totalTax;
        prevGrossSumYear = grossSumYear;
      }

      // Update the chart
      chartData.labels = grossSalaryRange;
      chartData.datasets[0].data = netSalaryYearRange;
      chartData.datasets[1].data = netDividendsRange;
      chartData.datasets[2].data = pensionRange;
      chartData.datasets[3].data = profitAfterDividendsRange;
      chartData.datasets[4].data = totalTaxRange;
      chartData.datasets[5].data = bolagsTaxExclDividendsRange;
      chartData.datasets[6].data = [maxSumXY];
      myChart.update();

      percentageChartData.labels = grossSalaryRange;
      percentageChartData.datasets[0].data = taxPercentageRange;
      percentageChartData.datasets[1].data = marginalTaxPercentageRange;
      percentageChartData.datasets[2].data = [minTaxXY];
      percentageChart.update();
    }
