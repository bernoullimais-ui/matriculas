const axios = require('axios');
async function run() {
  const secretKey = 'sk_...'; // I will just copy the env var from local env
  require('dotenv').config({ path: '.env.local' });
  const key = process.env.VITE_PAGARME_SECRET_KEY || process.env.PAGARME_SECRET_KEY;
  if (!key) { console.log('no key'); return; }
  
  const authHeader = Buffer.from(`${key}:`).toString('base64');
  try {
    const orderCode = `retry_pix_${Date.now()}`;
    const { data: orderData } = await axios.post('https://api.pagar.me/core/v5/orders', {
      code: orderCode,
      items: [{ amount: 100, description: "Teste PIX", quantity: 1, code: orderCode }],
      customer: {
        name: "Bruno Maia",
        email: "maiabruno+new123@msn.com",
        type: "individual",
        document: "65448332025",
        phones: { mobile_phone: { country_code: "55", area_code: "71", number: "991414913" } }
      },
      payments: [{ payment_method: "pix", pix: { expires_in: 86400 } }]
    }, {
      headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/json' }
    });
    console.log(JSON.stringify(orderData, null, 2));
  } catch (err) {
    console.log(err.response?.data || err.message);
  }
}
run();
