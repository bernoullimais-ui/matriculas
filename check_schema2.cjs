require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('pagamentos').select('*').limit(1);
  if (error) console.error("Error:", error);
  else if (data && data.length > 0) console.log("Columns:", Object.keys(data[0]));
  else console.log("No data, but table exists.");
}
check();
