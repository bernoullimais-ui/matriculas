const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: campaigns } = await supabase.from('campaigns').select('id, slug, nome, tipo, disparado_em').order('created_at', { ascending: false }).limit(3);
  console.log('Recent campaigns:', campaigns);
}
test();
