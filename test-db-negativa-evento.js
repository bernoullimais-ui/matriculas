import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const fetchAll = async (table) => {
  let all = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const { data } = await supabase.from(table).select('*').range(from, from + limit - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < limit) break;
    from += limit;
  }
  return all;
};

async function run() {
  const alunos = await fetchAll('alunos');
  const matriculas = await fetchAll('matriculas');
  const turmas = await fetchAll('turmas');
  const eventos = await fetchAll('eventos');
  const evento_inscricoes = await fetchAll('evento_inscricoes');
  
  const context = { alunos, matriculas, turmas, eventos, evento_inscricoes };
  
  let foundDaniel = false;

  for (const aluno of context.alunos) {
      if (!context.aluno || !context.matriculas || !context.turmas || !context.eventos || !context.evento_inscricoes) {
          // ignore
      }
      
      // Override context.aluno for loop
      context.aluno = aluno;

      // Condição 1: Matrículas ativas em Judô
      let temMatriculaAtivaJudo = false;
      const matriculasDoAluno = context.matriculas.filter(m => m.aluno_id === context.aluno.id);

      for (const matricula of matriculasDoAluno) {
          const status = matricula.status || '';
          if (['ativo', 'ativa'].includes(status.toLowerCase())) {
              const turma = context.turmas.find(t => t.id === matricula.turma_id);
              if (turma && turma.nome && turma.nome.toLowerCase().includes('judô')) {
                  temMatriculaAtivaJudo = true;
                  break;
              }
          }
      }

      if (!temMatriculaAtivaJudo) {
          continue;
      }

      // Condição 2: Não fez inscrição no evento 'Exame de Faixas'
      let fezInscricaoExameFaixas = false;
      const eventoExameFaixas = context.eventos.find(e => e.titulo && e.titulo.toLowerCase().includes('exame de faixas'));

      if (eventoExameFaixas) {
          const inscricoesDoAluno = context.evento_inscricoes.filter(i => i.aluno_id === context.aluno.id);
          for (const inscricao of inscricoesDoAluno) {
              if (inscricao.evento_id === eventoExameFaixas.id) {
                  // A IA agora verifica se encontrou a inscricao.
                  const inscStatus = inscricao.status || '';
                  if (['confirmado', 'confirmada'].includes(inscStatus.toLowerCase())) {
                      fezInscricaoExameFaixas = true;
                      break;
                  }
              }
          }
      }

      const match = temMatriculaAtivaJudo && !fezInscricaoExameFaixas;
      if (match && aluno.nome_completo.toLowerCase().includes('daniel') && aluno.nome_completo.toLowerCase().includes('rufino')) {
          foundDaniel = true;
      }
  }
  
  console.log("Encontrou Daniel?", foundDaniel);
}
run();
