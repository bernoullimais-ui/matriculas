const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('campaigns').select('*, campaign_landing_pages(*)').eq('slug', 'bunny2026-2');
  console.log(JSON.stringify(data, null, 2));
}
test();
