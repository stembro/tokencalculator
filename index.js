((context) => {
  const api = context.api
  const ui = context.ui
  let icoData = []

  /*Function that will create all of the dropdowns on the UI*/
  function populateStaticLists() {
    //Populating currencyBox
    const currencies = [
      'USD ($)', 'CAD ($)', 'EUR (€)', 'CNY (¥)', 'KRW (₩)', 'GBP (£)', 'JPY (¥)'
    ];
    
    currencies.forEach((currency, i) => {
      const option = document.createElement('option');
      option.text = option.value = currency
      ui.currencyBox.add(option, i+1);
    })
    
    ui.currencyBox.selectedIndex = "0";
    
    //Populating tokensale roundBox
    const crowdsale = document.createElement('option')
    crowdsale.text = crowdsale.value = "Crowdsale"
    
    const presale = document.createElement('option')
    presale.text = presale.value = "Pre-Sale"
    
    ui.roundBox.add(crowdsale, 1)
    ui.roundBox.add(presale, 2)
    ui.roundBox.selectedIndex = '0'
  }
  
  /*Function that will populate the list of ICOs on the UI*/
  function populateICOList(icoNames) {
    ui.icosBox.innerHTML = null

    icoNames.sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    
    icoNames.reverse();
    
    icoNames.forEach(function(ico) {
        const icoToAdd = document.createElement('option');
        icoToAdd.text = icoToAdd.value = ico;
        ui.icosBox.add(icoToAdd, 0);
    });
    
    const selectICOoption = document.createElement('option');
    selectICOoption.text = selectICOoption.value = 'Select ICO';
    ui.icosBox.add(selectICOoption, 0);
    
    ui.icosBox.selectedIndex = "0";
  }
  
  /*Function that will load the ICO data */
  function loadICOData() {
    return fetch(api.googleICOSheet)
      .then(response => response.text())
      .then(responseText => JSON.parse(responseText.match(/\((.*)\);/)[1]))
      .then(rawJson => rawJson.feed.entry.reduce((acc,entry) => {
      	acc.push(Object.keys(entry)
      	  .filter(key => key.indexOf('gsx$') !==-1)
      	  .reduce((acc,key) => {
      		  acc[key.replace('gsx$','')] = entry[key].$t
      		  return acc
          }, {}))
      	return acc
      },[]))
  }
  
  function refreshICOData() {
    return loadICOData()
      .then(data => {
        icoData = data
        populateICOList(data.map(ico => ico.companyname))
      })
  }
  
  /*Function that converts amount in specified currency to USD*/
  function convertFiatToEther(fiatAmount, currency) {
    return fetch(api.currencyExchange)
      .then(resp => resp.json())
      .then(data => {
        const exchangerate = currency === "USD" ? 1 : data.rates[currency];
        const usdamount = fiatAmount / exchangerate;
      
        //Convert amount to Ether
        return fetch(api.ethereumCoinmarketCap)
          .then(resp => resp.json())
          .then(data => {
            return (usdamount / data[0].price_usd)
        })
    })
  }
  
  // Function that converts ether to amount of tokens
  function calculateTokenCount (etherCount, icoName, isPresale) {
    let tokenCount = 0;
    let tokenName = "";
    
    const data = icoData.map(ico => ico)
      
    for (var i = 0; i < Object.keys(data).length; i++) {
      if (data[i].companyname === icoName) {
        tokenName = data[i].tokenname
        //checking ico has pre-sale numbers available if pre-sale is selected as round
        if (isPresale && !data[i]["minpre-saletokensforoneeth"]) {
          alert("Oops, we are sorry! No pre-sale Data is available for " + icoName + " at the moment." )
          return;
        } else if (isPresale && data[i]["minpre-saletokensforoneeth"]) {
          tokenCount = parseInt(data[i]["minpre-saletokensforoneeth"]) * etherCount;
        } else {
          tokenCount = parseInt(data[i].minimumcrowdsaletokensforoneeth) * etherCount;
        }
        break;
      }
    }
    
    return ({tokenCount: tokenCount.toFixed(2), tokenName})
  }
  
  /*Function that will calculate tokens */
  function onCalculateClick () {
    ui.resultBox.value = 'Loading...'
    let fiatInvestmentAmt = ui.amountBox.value
    let missingSelection = !ui.icosBox.selectedIndex || !ui.currencyBox.selectedIndex || !ui.roundBox.selectedIndex

    if (missingSelection || (fiatInvestmentAmt <= 0)) {
      alert("Oops! Could not Calculate Tokens. Please input all fields in the calculator and make sure the investment amount is a positive number then try again. Click OK to continue.");
      ui.resultBox.value = ''
      return;
    }
    else {
      let ico = ui.icosBox.options[ui.icosBox.selectedIndex].text;
      let isPresale = false;
      let currency = ui.currencyBox.options[ui.currencyBox.selectedIndex].text;
      currency = currency.substring(0, currency.indexOf(' ')).trim();
      if (ui.roundBox.selectedIndex === 2) {
        isPresale = true;
      };

      convertFiatToEther(fiatInvestmentAmt, currency)
        .then(etherCount => {
          const result = calculateTokenCount(etherCount, ico, isPresale)
          if (result) {
            ui.resultBox.value = `${result.tokenCount} ${result.tokenName} Tokens`
          } else {
            ui.resultBox.value = 'Please try again.'
          }
        }).catch(err => {
          ui.resultBox.value = 'Please try again.'
        })
    }
  }
  
  /*Auto-recalculate when form selections are changed */
  function onSelectionChange(){
    if (ui.amountBox.value > 0 && ui.icosBox.selectedIndex != 0 && ui.roundBox.selectedIndex != 0 && ui.currencyBox != 0) {
        onCalculateClick();
    }
  }
  
  /*Auto-recalculate when investment amount is updated */
  function onAmountChange() {
    if (ui.amountBox.value && ui.resultBox.value) {
      onCalculateClick()
    }
  }
  
  populateStaticLists()
  refreshICOData()

  ui.calculateButton.addEventListener('click', onCalculateClick)
  ui.icosBox.addEventListener('change', onSelectionChange)
  ui.currencyBox.addEventListener('change', onSelectionChange)
  ui.roundBox.addEventListener('change', onSelectionChange)
  ui.amountBox.addEventListener('change', onAmountChange)
  
})({
  api: {
    currencyExchange: 'https://api.fixer.io/latest?base=USD',
    ethereumCoinmarketCap: 'https://api.coinmarketcap.com/v1/ticker/ethereum/',
    googleICOSheet: 'https://spreadsheets.google.com/feeds/list/1y_Rg6i0Yu_uqJ8EqPbwWqlA75f-w84aH3nJ_QiKrbsQ/1/public/values?alt=json-in-script&callback=cb'
  },
  ui: {
    icosBox: document.querySelector('#icos'),
    currencyBox: document.querySelector('#currencies'),
    roundBox: document.querySelector('#rounds'),
    amountBox: document.querySelector('#investmentamount'),
    resultBox: document.querySelector('#tokensresult'),
    calculateButton: document.querySelector('#startTokenCalc')
  }
})
