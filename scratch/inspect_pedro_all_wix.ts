import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const apiKey = process.env.WIX_API_KEY;
  const accountId = process.env.WIX_ACCOUNT_ID;
  const siteId = process.env.WIX_SITE_ID_2 || 'ca1ea66d-ff08-4199-a149-34d09ecf0cc3';

  if (!apiKey || !accountId) {
    console.error('WIX_API_KEY or WIX_ACCOUNT_ID is missing from environment.');
    return;
  }

  const headers = {
    'Authorization': apiKey,
    'wix-account-id': accountId,
    'wix-site-id': siteId
  };

  const contactId = '3f89eb2a-64ac-4da7-8af5-d03e55574a5f';
  console.log(`Fetching all orders for site ${siteId} and filtering for contact ${contactId}...`);

  const contactOrders: any[] = [];
  let offset = 0;
  const limit = 50;
  let hasNext = true;
  let pageNum = 1;

  do {
    console.log(`Fetching page ${pageNum}...`);
    const params = { limit, offset };
    const resOrders = await axios.get('https://www.wixapis.com/pricing-plans/v2/orders', { headers, params });
    const page = resOrders.data.orders || [];
    
    const matches = page.filter((o: any) => o.buyer?.contactId === contactId);
    if (matches.length > 0) {
      contactOrders.push(...matches);
    }

    const meta = resOrders.data.pagingMetadata;
    hasNext = meta?.hasNext || false;
    offset += limit;
    if (page.length < limit || !hasNext) break;
    await new Promise(r => setTimeout(r, 100));
    pageNum++;
  } while (hasNext);

  console.log(`Found ${contactOrders.length} orders for Pedro.`);
  for (const order of contactOrders) {
    console.log(`Order Plan: ${order.planName}, ID: ${order.id}, Status: ${order.status}`);
    console.log(JSON.stringify(order, null, 2));
  }
}

run().catch(console.error);
