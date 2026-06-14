import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const sql = `
    ALTER TABLE turmas ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0;
  `;
  console.log('Tentando executar via RPC exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('Erro ao executar via RPC:', error);
  } else {
    console.log('Sucesso!', data);
  }
}

main().catch(console.error);
