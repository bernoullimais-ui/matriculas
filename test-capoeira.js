import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: turmas, error } = await supabase.from('turmas').select('id, nome, unidades_selecionadas');
  if (error) console.error(error);
  const capoeiraDomPedrinho = (turmas || []).filter(t => 
    t.nome.toLowerCase().includes('capoeira') && 
    t.unidades_selecionadas && t.unidades_selecionadas.some(u => u.toLowerCase().includes('dom pedrinho'))
  );
  console.log("Turmas:", capoeiraDomPedrinho.map(t => t.nome));

  const turmaIds = capoeiraDomPedrinho.map(t => t.id);
  const { data: matriculas } = await supabase.from('matriculas').select('aluno_id, status').in('turma_id', turmaIds);
  console.log("Total Matriculas nessas turmas:", (matriculas||[]).length);

  const ativas = (matriculas||[]).filter(m => m.status && m.status.toLowerCase() === 'ativo');
  console.log("Total Matriculas Ativas:", ativas.length);

  const alunoIds = ativas.map(m => m.aluno_id);
  if (alunoIds.length > 0) {
    const { data: alunos } = await supabase.from('alunos').select('id, nome_completo, unidade').in('id', alunoIds);

    console.log("Alunos ativos nessas turmas:");
    alunos.forEach(a => {
        console.log(`- ${a.nome_completo} | Unidade Principal: ${a.unidade}`);
    });
  }
}
run();
