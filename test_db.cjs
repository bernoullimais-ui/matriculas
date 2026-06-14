const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('logs').select('*').limit(1);
  console.log('logs:', data || error);
  const { data: d2, error: e2 } = await supabase.from('feed').select('*').limit(1);
  console.log('feed:', d2 || e2);
}
check();
