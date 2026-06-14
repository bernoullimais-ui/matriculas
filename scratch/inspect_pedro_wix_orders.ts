import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const apiKey = process.env.WIX_API_KEY;
  const accountId = process.env.WIX_ACCOUNT_ID;
  const siteIds = [];
  if (process.env.WIX_SITE_ID) siteIds.push(process.env.WIX_SITE_ID);
  else siteIds.push('b4fb0ff7-7e69-4f24-8cd5-5551ce7720b1');
  if (process.env.WIX_SITE_ID_2) siteIds.push(process.env.WIX_SITE_ID_2);

  if (!apiKey || !accountId) {
    console.error('WIX_API_KEY or WIX_ACCOUNT_ID is missing from environment.');
    return;
  }

  for (const siteId of siteIds) {
    console.log(`\n--- Searching Site ID: ${siteId} ---`);
    const headers = {
      'Authorization': apiKey,
      'wix-account-id': accountId,
      'wix-site-id': siteId
    };

    console.log('Querying Wix Contacts for email lamylyaf@hotmail.com...');
    try {
      const resQuery = await axios.post(
        'https://www.wixapis.com/contacts/v4/contacts/query',
        {
          query: {
            filter: {
              'primaryInfo.email': { $eq: 'lamylyaf@hotmail.com' }
            }
          }
        },
        { headers }
      );

      const contact = resQuery.data.contacts?.[0];
      if (!contact) {
        console.log('Contact not found on this site!');
        continue;
      }

      console.log('Contact found:', contact.id);

      console.log('Fetching orders for contact from Wix API...');
      const resOrders = await axios.get('https://www.wixapis.com/pricing-plans/v2/orders', {
        headers,
        params: { limit: 50 }
      });

      const allOrders = resOrders.data.orders || [];
      const contactOrders = allOrders.filter((o: any) => o.buyer?.contactId === contact.id);

      console.log(`Found ${contactOrders.length} orders for Pedro.`);
      for (const order of contactOrders) {
        console.log(`Order Plan: ${order.planName}, ID: ${order.id}, Status: ${order.status}, cycles count: ${order.cycles?.length || 0}`);
        console.log(JSON.stringify(order, null, 2));
      }
    } catch (err: any) {
      console.error('Error on site:', siteId, err.message);
    }
  }
}

run().catch(console.error);
