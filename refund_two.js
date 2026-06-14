import axios from 'axios';
import fs from 'fs';

const envFile = fs.readFileSync('.env.vercel', 'utf8');
let secretKey = envFile.match(/PAGARME_SECRET_KEY=(.*)/)[1];
if ((secretKey.startsWith('"') && secretKey.endsWith('"')) || (secretKey.startsWith("'") && secretKey.endsWith("'"))) {
  secretKey = secretKey.substring(1, secretKey.length - 1);
}
const authHeader = Buffer.from(`${secretKey}:`).toString('base64');

async function refundByCode(code) {
  try {
    const res = await axios.get(`https://api.pagar.me/core/v5/charges?code=${code}`, {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });
    const charges = res.data.data;
    if (charges && charges.length > 0) {
      const chargeId = charges[0].id;
      console.log("Found charge id:", chargeId);
      const refundRes = await axios.delete(`https://api.pagar.me/core/v5/charges/${chargeId}`, {
        headers: { 'Authorization': `Basic ${authHeader}` }
      });
      console.log(`Refund success for ${chargeId}:`, refundRes.data.status);
    } else {
      console.log("Charge not found by code.");
    }
  } catch (e) {
    console.error(`Error:`, e.response?.status, e.response?.data || e.message);
  }
}

refundByCode('c722a95e-372a-453a-8db1-9f7e06716e55_1774963066703-02');
