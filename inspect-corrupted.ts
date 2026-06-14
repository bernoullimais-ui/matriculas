import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { count: resp } = await supabase.from('responsaveis').select('*', { count: 'exact', head: true });
  const { count: alun } = await supabase.from('alunos').select('*', { count: 'exact', head: true });
  const { count: mat } = await supabase.from('matriculas').select('*', { count: 'exact', head: true });

  console.log(`Responsaveis: ${resp}`);
  console.log(`Alunos: ${alun}`);
  console.log(`Matriculas: ${mat}`);
}

run();
