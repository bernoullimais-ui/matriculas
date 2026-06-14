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

  console.log('Querying Wix Contacts for email heisinha1@gmail.com...');
  const resQuery = await axios.post(
    'https://www.wixapis.com/contacts/v4/contacts/query',
    {
      query: {
        filter: {
          'primaryInfo.email': { $eq: 'heisinha1@gmail.com' }
        }
      }
    },
    { headers }
  );

  const contact = resQuery.data.contacts?.[0];
  if (!contact) {
    console.log('Contact not found on Wix!');
    return;
  }

  console.log('Contact found:', contact.id);

  console.log('Fetching orders for contact...');
  const resOrders = await axios.get('https://www.wixapis.com/pricing-plans/v2/orders', {
    headers,
    params: { limit: 50 }
  });

  const allOrders = resOrders.data.orders || [];
  const contactOrders = allOrders.filter((o: any) => o.buyer?.contactId === contact.id);

  console.log(`Found ${contactOrders.length} orders for Gustavo's email.`);
  for (const order of contactOrders) {
    console.log(JSON.stringify(order, null, 2));
  }
}

run().catch(console.error);
