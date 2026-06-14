import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.production' });

const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
const authHeader = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');

async function run() {
  const invoiceId = 'in_PZwEjpUk2fynROqk';
  console.log(`Fetching invoice ${invoiceId} details...`);
  try {
    const response = await axios.get(`https://api.pagar.me/core/v5/invoices/${invoiceId}`, {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error("Error fetching invoice:", error.message);
    if (error.response) {
      console.error(error.response.data);
    }
  }
}

run();
