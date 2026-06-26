const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*, campaign_targets(*), campaign_emails(*), campaign_landing_pages(*), campaign_metrics(*)')
    .eq('id', '4f77e175-99d8-4815-8d5c-5ceafa719672')
    .maybeSingle();
  console.log('targets Is Array?', Array.isArray(data.campaign_targets));
  console.log('emails Is Array?', Array.isArray(data.campaign_emails));
  console.log('landing_pages Is Array?', Array.isArray(data.campaign_landing_pages));
}
test();
