import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.production' });

const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
const authHeader = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');

async function run() {
  console.log("Fetching one invoice from list API...");
  try {
    const response = await axios.get('https://api.pagar.me/core/v5/invoices?status=paid&size=1', {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });
    const inv = response.data.data[0];
    console.log("Invoice keys:", Object.keys(inv));
    console.log("Invoice structure:", JSON.stringify({
      id: inv.id,
      subscription_id: inv.subscription_id,
      subscription: inv.subscription,
      charge: inv.charge ? { id: inv.charge.id } : null,
      customer: inv.customer ? { name: inv.customer.name, email: inv.customer.email } : null
    }, null, 2));
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

run();
