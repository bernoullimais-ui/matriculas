const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: campaign } = await supabase.from('campaigns').select('tipo').eq('id', '4f77e175-99d8-4815-8d5c-5ceafa719672').maybeSingle();
  console.log('Tipo:', campaign.tipo);
}
test();
