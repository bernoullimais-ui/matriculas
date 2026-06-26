const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('pagamentos').select('*').eq('id', '746f6c18-ddfb-4786-b017-bf3e8dd4e555').single();
  console.log(JSON.stringify(data, null, 2));
}
run();
