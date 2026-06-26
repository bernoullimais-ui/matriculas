const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('campaign_metrics').upsert({
      campaign_id: '4f77e175-99d8-4815-8d5c-5ceafa719672',
      emails_enviados: 1,
      emails_entregues: 1,
      updated_at: new Date().toISOString()
  }, { onConflict: 'campaign_id' }).select();
  console.log('Upsert with anon key:', data, 'Error:', error);
}
test();
