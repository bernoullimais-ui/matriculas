import axios from 'axios';
import fs from 'fs';

const envFile = fs.readFileSync('.env.vercel', 'utf8');
let secretKey = envFile.match(/PAGARME_SECRET_KEY=(.*)/)[1];
if ((secretKey.startsWith('"') && secretKey.endsWith('"')) || (secretKey.startsWith("'") && secretKey.endsWith("'"))) {
  secretKey = secretKey.substring(1, secretKey.length - 1);
}
const authHeader = Buffer.from(`${secretKey}:`).toString('base64');

async function test() {
  try {
    const invRes = await axios.get(`https://api.pagar.me/core/v5/invoices/in_vmJpb9wuBbHo4l3r`, {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });
    console.log("Invoice charge id:", invRes.data.charge?.id);
    console.log("Invoice charge:", JSON.stringify(invRes.data.charge));
  } catch (e) {
    console.error("Error fetching:", e.response?.data || e.message);
  }
}
test();
