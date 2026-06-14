const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function alterTable() {
  const { data, error } = await supabase.rpc('run_sql', { sql: "ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS cupom_id UUID REFERENCES cupons(id), ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC, ADD COLUMN IF NOT EXISTS tem_fidelidade BOOLEAN DEFAULT FALSE;" });
  if (error) {
    console.error("RPC failed, we might not have run_sql:", error);
  } else {
    console.log("Success:", data);
  }
}
alterTable();
