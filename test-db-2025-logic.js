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
      const studentMatriculas = context.matriculas.filter(m => m.aluno_id === aluno.id);

      if (studentMatriculas.length === 0) continue;

      const targetYear = 2025;
      const currentYear = 2026;

      let hasActiveInTargetYear = false;
      let failed = false;

      for (const matricula of studentMatriculas) {
          const startDate = new Date(matricula.data_matricula || matricula.created_at);
          const startYear = startDate.getFullYear();
          const status = matricula.status ? matricula.status.toLowerCase() : '';

          let effectiveEndYear; 
          let potentialEndYear; 

          if (['ativo', 'ativa'].includes(status)) {
              effectiveEndYear = currentYear;
              potentialEndYear = Infinity; 
          } else if (['cancelado', 'cancelada'].includes(status)) {
              if (!matricula.data_cancelamento) {
                  failed = true;
                  break;
              }
              effectiveEndYear = new Date(matricula.data_cancelamento).getFullYear();
              potentialEndYear = effectiveEndYear; 
          } else {
              continue;
          }

          if (startYear <= targetYear && targetYear <= potentialEndYear) {
              hasActiveInTargetYear = true;
          }

          if (startYear < targetYear) {
              failed = true;
              break;
          }

          if (startYear <= targetYear && effectiveEndYear > targetYear) {
              failed = true;
              break;
          }
          if (startYear > targetYear) {
              failed = true;
              break;
          }
      }

      if (!failed && hasActiveInTargetYear) {
          count++;
      }
  }
  
  console.log("Alunos pela logica ATUALIZADA DA IA 2025:", count);
}
run();
