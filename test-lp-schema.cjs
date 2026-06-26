const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('campaign_landing_pages').select('*').limit(1);
  if (error) console.log("Error:", error);
  else console.log("Cols:", data.length > 0 ? Object.keys(data[0]) : "Empty table but exists");
}
run();
