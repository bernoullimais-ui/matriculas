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
  
  const context = { alunos, matriculas };
  
  let count = 0;

  for (const aluno of context.alunos) {
      const alunoMatriculas = context.matriculas.filter(m => m.aluno_id === aluno.id);

      if (alunoMatriculas.length === 0) {
          continue; 
      }

      let hasEnrollmentStartingIn2024 = false;
      let hasEnrollmentStartingBefore2024 = false;
      let hasActiveEnrollmentNow = false;
      let hasCancellationAfter2024 = false;

      for (const matricula of alunoMatriculas) {
          const matriculaDate = new Date(matricula.data_matricula || matricula.created_at);
          const matriculaYear = matriculaDate.getFullYear();

          if (matriculaYear === 2024) {
              hasEnrollmentStartingIn2024 = true;
          }
          if (matriculaYear < 2024) {
              hasEnrollmentStartingBefore2024 = true;
          }

          const status = matricula.status ? matricula.status.toLowerCase() : '';
          if (status === 'ativo' || status === 'ativa') {
              hasActiveEnrollmentNow = true;
          }

          if (status.includes('cancelado')) {
              if (matricula.data_cancelamento) {
                  const cancelamentoDate = new Date(matricula.data_cancelamento);
                  const cancelamentoYear = cancelamentoDate.getFullYear();
                  if (cancelamentoYear > 2024) {
                      hasCancellationAfter2024 = true;
                  }
              }
          }
      }

      if (!hasEnrollmentStartingIn2024) continue;
      if (hasEnrollmentStartingBefore2024) continue;
      if (hasActiveEnrollmentNow) continue;
      if (hasCancellationAfter2024) continue;

      count++;
  }
  
  console.log("Alunos pela logica ATUALIZADA DA IA:", count);
}
run();
