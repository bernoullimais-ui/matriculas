import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { error } = await supabase.rpc('add_column_if_not_exists', {
    table_name: 'website_configs',
    column_name: 'testimonials_speed',
    data_type: 'integer'
  });
  console.log("RPC:", error);
  // fallback if no RPC
  if (error) {
     const query = "ALTER TABLE website_configs ADD COLUMN IF NOT EXISTS testimonials_speed integer DEFAULT 30;";
     // wait supabase JS client does not support raw queries directly, we can use a raw sql query via REST?
  }
}
test();
