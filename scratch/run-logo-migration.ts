import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const sql = `
    ALTER TABLE unidades ADD COLUMN IF NOT EXISTS logo_url text;
    ALTER TABLE unidades ADD COLUMN IF NOT EXISTS imagem_url text;
    ALTER TABLE turmas ADD COLUMN IF NOT EXISTS imagem_url text;
  `;

  console.log('Running ALTER statements via RPC exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('Successfully altered tables!', data);
  }
}

main().catch(console.error);
