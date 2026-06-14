import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.production' });
import axios from 'axios';

const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
const authHeader = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');

async function run() {
  const subId = 'sub_VozyGnRWUeTnGK5Q';
  try {
    // Search invoices by subscription id
    const response = await axios.get(`https://api.pagar.me/core/v5/invoices?subscription_id=${subId}`, {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });
    console.log(`Invoices for subscription ${subId}:`);
    for (const inv of response.data.data) {
      console.log(`Invoice ID: ${inv.id} | Status: ${inv.status} | Amount: ${inv.amount} | Due: ${inv.due_at} | Created: ${inv.created_at} | Method: ${inv.payment_method}`);
      if (inv.charge) {
        console.log(`  -> Charge ID: ${inv.charge.id} | Paid: ${inv.charge.paid_at} | Status: ${inv.charge.status}`);
      }
    }
  } catch (err: any) {
    console.error(err.response?.data || err.message);
  }
}

run();
