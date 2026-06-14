import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20260605000002_add_landing_page_fields.sql');
  console.log('Reading migration file:', sqlPath);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running SQL migration via RPC exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Error running RPC exec_sql:', error);
    console.log('Fallback: Please run the SQL queries manually in the Supabase Editor.');
  } else {
    console.log('Migration completed successfully!', data);
  }
}

run();
