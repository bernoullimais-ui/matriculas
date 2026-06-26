const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('pagamentos').select('qr_code, qr_code_url, status, psp_reference_id').eq('id', '746f6c18-ddfb-4786-b017-bf3e8dd4e555');
  console.log(data, error);
}
run();
