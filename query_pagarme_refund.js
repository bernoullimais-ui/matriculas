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
    const refundRes = await axios.delete(`https://api.pagar.me/core/v5/charges/ch_GzDVoNgs8iE2Yb2K`, {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });
    console.log("Refund success:", refundRes.data);
  } catch (e) {
    console.error("Refund failed:", e.response?.status, e.response?.data || e.message);
  }
}
test();
