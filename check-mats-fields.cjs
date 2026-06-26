const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: mats } = await supabase.from('matriculas').select('*').limit(1);
  console.log('Matricula keys:', Object.keys(mats[0] || {}));
}
test();
