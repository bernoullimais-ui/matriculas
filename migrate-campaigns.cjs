const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { error } = await supabase.rpc('exec_sql', {
    query: "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS metodo_envio text DEFAULT 'email';"
  });
  console.log('Migrate via RPC:', error || 'Success');

  if (error) {
    // try direct pool query if RPC doesn't exist
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await pool.query("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS metodo_envio text DEFAULT 'email';");
      console.log('Migrate via PG pool: Success');
    } catch(e) {
      console.log('Migrate via PG pool error:', e);
    }
  }
}
run();
