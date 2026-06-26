const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: m } = await supabase.from('campaign_metrics').select('*').eq('campaign_id', '4f77e175-99d8-4815-8d5c-5ceafa719672');
  console.log('All metrics rows:', m);
}
test();
