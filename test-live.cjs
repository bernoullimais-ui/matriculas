const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('https://www.sportforkids.com.br', { waitUntil: 'networkidle0' });
  
  await browser.close();
}
test();
