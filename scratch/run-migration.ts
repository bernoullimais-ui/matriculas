import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const sql = `
    ALTER TABLE unidades ADD COLUMN IF NOT EXISTS logo_url text;
    ALTER TABLE turmas ADD COLUMN IF NOT EXISTS imagem_url text;
  `;

  console.log('Running SQL migration via RPC...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Error running RPC exec_sql:', error);
    console.log('Fallback: You can run this SQL in the Supabase Dashboard SQL Editor:');
    console.log(sql);
  } else {
    console.log('Migration completed successfully!', data);
  }
}

run();
