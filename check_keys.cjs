const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function printKeys() {
  const { data } = await supabase.from('franquias').select('unidade, pagarme_api_key').limit(5);
  console.log(data);
}
printKeys();
