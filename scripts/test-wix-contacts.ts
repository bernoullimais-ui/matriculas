import * as dotenv from 'dotenv';
dotenv.config();

async function testWix() {
  const apiKey = process.env.WIX_API_KEY;
  const accountId = process.env.WIX_ACCOUNT_ID;
  const siteId = 'b4fb0ff7-7e69-4f24-8cd5-5551ce7720b1';

  try {
    const contactId = 'c53047fa-91d2-4046-8762-304c79b7d444'; // from previous response
    const res = await fetch(`https://www.wixapis.com/contacts/v4/contacts/${contactId}`, {
      headers: {
        'Authorization': apiKey!,
        'wix-account-id': accountId!,
        'wix-site-id': siteId
      }
    });
    
    if (!res.ok) {
      console.error(res.status, await res.text());
    } else {
      const data = await res.json();
      console.log('Contact info:', JSON.stringify(data.contact.primaryInfo, null, 2));
    }
  } catch(e) {
    console.error(e);
  }
}
testWix();
