const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: identidades } = await supabase.from('identidades').select('*').limit(1);
  const identity = identidades[0];
  
  if (!identity || !identity.utalk_token) return;

  const payload = {
    toPhone: "5531999999999",
    fromPhone: identity.utalk_from_phone.replace(/\D/g, ''),
    organizationId: identity.utalk_organization_id,
    mediaUrl: "https://sportforkids.com.br/assets/logo.png",
    caption: "This is a caption"
  };

  const response = await fetch("https://app-utalk.umbler.com/api/v1/messages/simplified/", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${identity.utalk_token}` },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Response:", text);
}
run();
