import axios from 'dotenv';
import axiosLib from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.WIX_API_KEY!;
const accountId = process.env.WIX_ACCOUNT_ID!;
const siteId = 'ca1ea66d-ff08-4199-a149-34d09ecf0cc3';

async function run() {
  try {
    const response = await axiosLib.get('https://www.wixapis.com/pricing-plans/v2/orders/05caf720-7863-4f64-8653-51e4b52736b1', {
      headers: {
        'Authorization': apiKey,
        'wix-account-id': accountId,
        'wix-site-id': siteId
      }
    });
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error("Error fetching order:", error.message);
  }
}

run();
