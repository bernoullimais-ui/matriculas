import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const [{ count: rCount }, { count: aCount }, { count: mCount }] = await Promise.all([
    supabase.from('responsaveis').select('*', { count: 'exact', head: true }),
    supabase.from('alunos').select('*', { count: 'exact', head: true }),
    supabase.from('matriculas').select('*', { count: 'exact', head: true })
  ]);
  console.log("Responsaveis:", rCount);
  console.log("Alunos:", aCount);
  console.log("Matriculas:", mCount);
}
run();
