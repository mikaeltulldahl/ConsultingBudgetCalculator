const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = 'http://localhost:8080/index.html';
  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });

  // Wait for key fields to be present
  await page.waitForSelector('#invoicedAmount', { timeout: 15000 });

  // Set some inputs and trigger update
  await page.evaluate(() => {
    document.getElementById('hourlyRate').value = '700';
    document.getElementById('billableHours').value = '160';
    document.getElementById('otherRevenue').value = '0';
    document.getElementById('otherCosts').value = '20000';
    document.getElementById('billableHours').dispatchEvent(new Event('input'));
    document.getElementById('hourlyRate').dispatchEvent(new Event('input'));
  });

  // Call the global updateAll if available
  await page.evaluate(() => {
    if (typeof window.updateAll === 'function') {
      window.updateAll();
    }
  });

  // Wait a moment for async computations
  await page.waitForTimeout(1000);

  // Read a few outputs
  const profitAfterTax = await page.$eval('#profitAfterTax', el => el.value || '');
  const totalTax = await page.$eval('#totalTax', el => el.value || '');
  console.log('profitAfterTax=', profitAfterTax);
  console.log('totalTax=', totalTax);

  await browser.close();
})();
