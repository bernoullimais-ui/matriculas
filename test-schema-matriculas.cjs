const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('matriculas').select('*').eq('status', 'cancelado').limit(5);
  console.log("Matriculas canceladas sample:", data);
}
run();
