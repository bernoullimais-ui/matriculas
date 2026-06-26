const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: m } = await supabase.from('campaign_metrics').select('visitas_lp, campaign_id').eq('campaign_id', '4f77e175-99d8-4815-8d5c-5ceafa719672').maybeSingle();
  console.log('Metrics before:', m);
  if (m) {
    const { error } = await supabase.from('campaign_metrics').update({ visitas_lp: (m.visitas_lp || 0) + 1 }).eq('campaign_id', m.campaign_id);
    console.log('Update error:', error);
  }
  const { data: m2 } = await supabase.from('campaign_metrics').select('visitas_lp, campaign_id').eq('campaign_id', '4f77e175-99d8-4815-8d5c-5ceafa719672').maybeSingle();
  console.log('Metrics after:', m2);
}
test();
