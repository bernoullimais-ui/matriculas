import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function test() {
  const { data: alunos } = await supabase.from('alunos').select('*').ilike('nome_completo', '%Lucca%Bomfim%');
  console.log("Found Lucca:", alunos?.length);
  if (alunos && alunos.length > 0) {
    for (const a of alunos) {
      console.log(`Aluno ${a.id}: ${a.nome_completo}`);
      const { data: resp } = await supabase.from('responsaveis').select('*').eq('id', a.responsavel_id);
      console.log(`  - Responsavel: ${resp?.[0]?.nome_completo} (${resp?.[0]?.email})`);
    }
  }
}

test();
