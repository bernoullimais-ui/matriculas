const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

async function test() {
  const server = spawn('npm', ['run', 'preview']);
  
  await new Promise(resolve => setTimeout(resolve, 3000));

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
  
  await browser.close();
  server.kill();
}
test();
