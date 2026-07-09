import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data: alice } = await supabase
    .from('alunos')
    .select('id, nome_completo')
    .ilike('nome_completo', '%Alice%');
    
  console.log("Alunos:", alice);
  
  if (alice && alice.length > 0) {
    const ids = alice.map(a => a.id);
    const { data: trials } = await supabase
      .from('aulas_experimentais')
      .select('*')
      .in('aluno_id', ids);
    console.log("Trials:", trials);
  }
}
test();
