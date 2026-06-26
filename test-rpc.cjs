const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: c } = await supabase.from('campaigns').select('id, slug').limit(1);
  if (!c || c.length === 0) return console.log('No campaign found');
  console.log('Testing on campaign:', c[0]);
  
  const res = await supabase.rpc('increment_campaign_metric', { p_campaign_id: c[0].id, p_field: 'visitas_lp' });
  console.log('RPC result:', res);
  
  const { data: metrics } = await supabase.from('campaign_metrics').select('*').eq('campaign_id', c[0].id).single();
  console.log('Metrics:', metrics);
}
test();
