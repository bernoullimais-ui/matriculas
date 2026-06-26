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
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let count = 0;
  
  for (const aluno of context.alunos) {
      const alunoId = aluno.id;
      let matched = false;
      for (const matricula of context.matriculas) {
          if (matricula.aluno_id === alunoId) {
              const status = matricula.status ? matricula.status.toLowerCase() : '';
              if (status.includes('cancelado') || status.includes('cancelada')) {
                  if (matricula.data_cancelamento) {
                      const cancelDate = new Date(matricula.data_cancelamento);
                      if (cancelDate.getFullYear() === currentYear && cancelDate.getMonth() === currentMonth) {
                          matched = true;
                          break;
                      }
                  }
              }
          }
      }
      if (matched) count++;
  }
  
  console.log("Cancelamentos no mês:", count);
}
run();
