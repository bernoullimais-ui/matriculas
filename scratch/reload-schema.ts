import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('Sending NOTIFY pgrst, reload schema...');
  const { data, error } = await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" });
  if (error) {
    console.error('Error reloading schema cache:', error);
  } else {
    console.log('Schema reload triggered successfully!', data);
  }
}

main().catch(console.error);
