import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const respId = 'ef60f677-52af-4c6f-bf8b-cc9b18df723c';
  console.log('Searching students for responsavel:', respId);
  
  const { data: students } = await supabase
    .from('alunos')
    .select('*')
    .eq('responsavel_id', respId);
    
  console.log('Students:', students);

  for (const s of students || []) {
    const { data: matriculas } = await supabase
      .from('matriculas')
      .select('*')
      .eq('aluno_id', s.id);
    console.log(`Matriculas for student ${s.nome_completo}:`, matriculas);
  }
}

check();
