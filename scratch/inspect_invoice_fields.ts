import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.production' });
import axios from 'axios';

const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
const authHeader = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');

async function run() {
  const invoiceId = 'in_q520Bbpi9MHpXJMx';
  try {
    const response = await axios.get(`https://api.pagar.me/core/v5/invoices/${invoiceId}`, {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });
    console.log(JSON.stringify(response.data, null, 2));
  } catch (err: any) {
    console.error(err.response?.data || err.message);
  }
}

run();
