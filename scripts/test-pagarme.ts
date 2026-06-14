import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });
import axios from 'axios';

const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
const authHeader = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');

async function main() {
  try {
    const response = await axios.get('https://api.pagar.me/core/v5/invoices?status=paid&size=1', {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });
    console.log(JSON.stringify(response.data.data[0], null, 2));
  } catch (error: any) {
    console.error('API call failed:', error.response?.data || error.message);
  }
}
main();
