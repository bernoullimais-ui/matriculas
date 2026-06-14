import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: series, error: sErr } = await supabase.from('series_anos').select('*');
  if (sErr) console.error('Error series:', sErr);
  else console.log('series_anos:', series);

  const { data: turmas, error: tErr } = await supabase.from('turmas').select('nome, series_permitidas');
  if (tErr) console.error('Error turmas:', tErr);
  else console.log('turmas series_permitidas:', turmas);
}

main();
