import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.WIX_API_KEY!;
const accountId = process.env.WIX_ACCOUNT_ID!;
const siteIds = ['b4fb0ff7-7e69-4f24-8cd5-5551ce7720b1', 'ca1ea66d-ff08-4199-a149-34d09ecf0cc3'];

async function run() {
  console.log("Searching for Wix orders...");
  
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
      console.log(`Fetched ${orders.length} orders.`);
      
      const targetOrders = orders.filter((o: any) => 
        o.id === '05caf720-7863-4f64-8653-51e4b52736b1' ||
        o.planName?.toLowerCase().includes('ballet') ||
        o.buyer?.email?.toLowerCase() === 'rebecabrasilcosta@gmail.com'
      );
      
      for (const order of targetOrders) {
        console.log(`\nOrder ID: ${order.id}`);
        console.log(`Plan Name: ${order.planName}`);
        console.log(`Status: ${order.status}`);
        console.log(`Last Payment Status: ${order.lastPaymentStatus}`);
        console.log(`Buyer Email: ${order.buyer?.email || 'N/A'}`);
        console.log(`Buyer ContactId: ${order.buyer?.contactId || 'N/A'}`);
        console.log(`Current Cycle Index: ${order.currentCycle?.index}`);
        console.log(`Current Cycle StartedDate: ${order.currentCycle?.startedDate}`);
        console.log(`Cycles Count: ${order.cycles?.length}`);
        if (order.cycles) {
          console.log("Cycles details:", order.cycles.map((c: any) => ({
            index: c.index,
            startedDate: c.startedDate,
            endedDate: c.endedDate
          })));
        }
      }
    } catch (error: any) {
      console.error(`Error for site ${siteId}:`, error.message);
      if (error.response) {
        console.error("Response data:", error.response.data);
      }
    }
  }
}

run();
