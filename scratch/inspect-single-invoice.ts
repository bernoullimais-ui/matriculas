import dotenv from 'dotenv';
import axios from 'axios';

// Load environmental config
dotenv.config();
dotenv.config({ path: '.env.production' });

const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
const authHeader = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');

async function main() {
  const invoiceId = "in_z2gepiEBIs2WZmx";
  console.log(`=== FETCHING INVOICE ${invoiceId} ===`);
  try {
    const response = await axios.get(`https://api.pagar.me/core/v5/invoices/${invoiceId}`, {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error("API call failed:", error.response?.data || error.message);
  }
}

main();
