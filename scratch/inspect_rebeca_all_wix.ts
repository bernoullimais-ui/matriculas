import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.WIX_API_KEY!;
const accountId = process.env.WIX_ACCOUNT_ID!;
const siteIds = ['b4fb0ff7-7e69-4f24-8cd5-5551ce7720b1', 'ca1ea66d-ff08-4199-a149-34d09ecf0cc3'];

async function run() {
  for (const siteId of siteIds) {
    console.log(`\n=== Checking site: ${siteId} ===`);
    try {
      const response = await axios.get('https://www.wixapis.com/pricing-plans/v2/orders?limit=50', {
        headers: {
          'Authorization': apiKey,
          'wix-account-id': accountId,
          'wix-site-id': siteId
        }
      });
      
      const orders = response.data.orders || [];
      const buyerContactIds = new Set<string>();
      
      // Let's first search contacts for email 'rebecabrasilcosta@gmail.com' to see if contactId matches
      // Since contactId is used in the orders response, we can filter by that.
      // Or we can query the contacts API to get the contactId for this email.
      console.log(`Total orders on site: ${orders.length}`);
      
      // Let's print any orders that might belong to Rebeca
      // We will print orders that have buyer details, or we can check the database mapping.
      // In the database:
      // - 05caf720-7863-4f64-8653-51e4b52736b1 has buyer contactId: a7c7c387-a6ec-4784-895b-809a6a1757d8.
      // Let's check other orders with contactId a7c7c387-a6ec-4784-895b-809a6a1757d8.
      const rebecaOrders = orders.filter((o: any) => o.buyer?.contactId === 'a7c7c387-a6ec-4784-895b-809a6a1757d8');
      console.log(`Found ${rebecaOrders.length} orders for contactId a7c7c387-a6ec-4784-895b-809a6a1757d8:`);
      
      for (const order of rebecaOrders) {
        console.log(`- Order ID: ${order.id} | Plan: ${order.planName} | Status: ${order.status} | LastPayment: ${order.lastPaymentStatus} | Cycles: ${order.cycles?.length}`);
      }
      
    } catch (e: any) {
      console.error("Error:", e.message);
    }
  }
}

run();
