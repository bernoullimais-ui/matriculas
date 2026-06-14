const axios = require('axios');
require('dotenv').config();

async function run() {
  const headers = {
    'Authorization': process.env.WIX_API_KEY,
    'wix-account-id': process.env.WIX_ACCOUNT_ID
  };
  try {
    const res = await axios.get('https://www.wixapis.com/site-management/v1/sites', { headers });
    console.log(JSON.stringify(res.data, null, 2));
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
