import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const apiKey = process.env.WIX_API_KEY;
  const accountId = process.env.WIX_ACCOUNT_ID;
  const siteId = process.env.WIX_SITE_ID || 'b4fb0ff7-7e69-4f24-8cd5-5551ce7720b1';

  if (!apiKey || !accountId) {
    console.error('WIX_API_KEY or WIX_ACCOUNT_ID is missing from environment.');
    return;
  }

  const headers = {
    'Authorization': apiKey,
    'wix-account-id': accountId,
    'wix-site-id': siteId
  };

  const orderId = '1ea0858e-5ae2-4d15-88b6-f208862ca8be';
  console.log(`Fetching Wix Order by ID: ${orderId}...`);

  try {
    const res = await axios.get(`https://www.wixapis.com/pricing-plans/v2/orders/${orderId}`, { headers });
    console.log(JSON.stringify(res.data.order, null, 2));
  } catch (err: any) {
    console.error('Error fetching order by ID:', err.response?.data || err.message);
  }
}

run().catch(console.error);
