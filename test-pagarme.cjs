const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const secretKey = process.env.VITE_PAGARME_SECRET_KEY || process.env.PAGARME_SECRET_KEY;
  if (!secretKey) return console.log("No secret key");
  const authHeader = Buffer.from(`${secretKey}:`).toString('base64');
  try {
    const res = await axios.get(`https://api.pagar.me/core/v5/orders/or_g942OzKfBI1QNX3r`, {
      headers: { Authorization: `Basic ${authHeader}` }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch(e) {
    console.log(e.response ? e.response.data : e.message);
  }
}
run();
