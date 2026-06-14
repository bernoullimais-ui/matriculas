import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.WIX_API_KEY!;
const accountId = process.env.WIX_ACCOUNT_ID!;
const siteId = 'ca1ea66d-ff08-4199-a149-34d09ecf0cc3';

async function run() {
  console.log("Testing Wix Payments v2 endpoint...");
  try {
    const response = await axios.get('https://www.wixapis.com/payments/v2', {
      headers: {
        'Authorization': apiKey,
        'wix-account-id': accountId,
        'wix-site-id': siteId
      }
    });
    console.log("Status Code:", response.status);
    console.log("Response Keys:", Object.keys(response.data));
    console.log("First 3 transactions:", JSON.stringify(response.data.transactions?.slice(0, 3), null, 2));
  } catch (error: any) {
    console.error("Error calling Wix Payments v2:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}

run();
