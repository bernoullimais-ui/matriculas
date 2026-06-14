import axios from 'axios';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const secretKey = envFile.match(/PAGARME_SECRET_KEY=(.*)/)[1];
const authHeader = Buffer.from(`${secretKey}:`).toString('base64');

async function test() {
  try {
    // Try to call POST /refund on a fake charge to see the error message
    await axios.post(`https://api.pagar.me/core/v5/charges/ch_fake/refund`, {}, {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });
  } catch (e) {
    console.log("POST /refund response:", e.response?.status, e.response?.data);
  }
  
  try {
    // Try DELETE
    await axios.delete(`https://api.pagar.me/core/v5/charges/ch_fake`, {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });
  } catch (e) {
    console.log("DELETE response:", e.response?.status, e.response?.data);
  }
}
test();
