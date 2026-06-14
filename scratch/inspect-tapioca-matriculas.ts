import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  const ids = ['3c0c789d-530b-4e95-9753-adaf7154529a', 'cab940f1-0005-428a-be24-7471b26c29e9'];
  const { data: mats } = await supabase.from('matriculas').select('*').in('aluno_id', ids);
  console.log("=== MATRICULAS ===");
  console.log(mats);
}
run();
