const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function alterTable() {
  const { data, error } = await supabase.rpc('run_sql', { sql: "ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS data_registro_cancelamento TIMESTAMP WITH TIME ZONE;" });
  if (error) {
    console.error("RPC failed, we might not have run_sql:", error);
    // If run_sql is not available, we can just try inserting and it'll fail, or use another way if needed.
  }
}
alterTable();
