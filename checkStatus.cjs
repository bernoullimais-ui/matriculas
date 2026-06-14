const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  const { data: resp } = await supabase.from('responsaveis').select('id').ilike('nome_completo', '%Davi Abreu Maia Miranda%');
  if (resp && resp.length > 0) {
    const { data: matriculas } = await supabase.from('matriculas').select('id, status, aluno_id, turma').eq('responsavel_id', resp[0].id);
    console.log("Matriculas using responsavel nome:", matriculas);
  } else {
    // Davi might be the student
    const { data: alunos } = await supabase.from('alunos').select('id, responsavel_id').ilike('nome_completo', '%Davi Abreu Maia Miranda%');
    if (alunos && alunos.length > 0) {
      const { data: matriculas } = await supabase.from('matriculas').select('id, status, aluno_id, turma').in('aluno_id', alunos.map(a => a.id));
      console.log("Matriculas using aluno nome:", matriculas);
    } else {
      console.log("Not found");
    }
  }
}
main();
