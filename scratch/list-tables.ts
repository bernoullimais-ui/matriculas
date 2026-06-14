import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
  });
  
  if (error) {
    // If exec_sql RPC doesn't exist, try querying pg_catalog via REST
    console.error('exec_sql error:', error.message);
    // Fallback: list some tables using direct API call if possible or try to query common names
    const commonTables = ['funcionarios', 'perfis', 'usuarios', 'colaboradores', 'roles', 'users', 'admin_users'];
    for (const table of commonTables) {
      const { data: tData, error: tErr } = await supabase.from(table).select('count').limit(1);
      if (!tErr) {
        console.log(`Table exists: ${table}`);
      }
    }
  } else {
    console.log('Tables:', data);
  }
}
run();
