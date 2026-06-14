import * as dotenv from 'dotenv';
dotenv.config();

async function testWix() {
  const apiKey = process.env.WIX_API_KEY;
  const accountId = process.env.WIX_ACCOUNT_ID;
  const siteId = 'b4fb0ff7-7e69-4f24-8cd5-5551ce7720b1';

  try {
    console.log('Fetching limit=100...');
    const res = await fetch('https://www.wixapis.com/pricing-plans/v2/orders?limit=100', {
      headers: { 'Authorization': apiKey!, 'wix-account-id': accountId!, 'wix-site-id': siteId }
    });
    console.log('Status code:', res.status);
    const text = await res.text();
    console.log('Body:', text.substring(0, 1000));
  } catch(e) {
    console.error(e);
  }
}
testWix();
