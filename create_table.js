const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_string: `
      CREATE TABLE IF NOT EXISTS admin_notifications_read (
        admin_id text PRIMARY KEY,
        last_read_at timestamp with time zone DEFAULT now()
      );
    `
  });
  console.log('Result:', data, error);
}
main();
