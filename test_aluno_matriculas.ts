import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: aluno } = await supabase
    .from('alunos')
    .select('*')
    .ilike('nome', '%Andrei%');
  
  if (aluno && aluno.length > 0) {
    console.log('Alunos:', aluno.map(a => a.nome));
    const { data: matriculas } = await supabase
      .from('matriculas')
      .select('*')
      .eq('aluno_id', aluno[0].id);
    console.log('Matriculas para o primeiro:', matriculas?.length);
    const { data: lead } = await supabase
      .from('leads_atendimento')
      .select('*')
      .eq('aluno_id', aluno[0].id);
    console.log('Lead?', lead?.length);
  } else {
    console.log('Nenhum aluno com Andrei');
  }
}
run();
