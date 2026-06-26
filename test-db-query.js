import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: turmas } = await supabase.from('turmas').select('*');
  const akaTurmas = turmas.filter(t => t.unidades_selecionadas && t.unidades_selecionadas.some(u => u.toLowerCase().includes('aka')));
  console.log("Turmas AKA Dojo:", akaTurmas.map(t => t.id));
  
  if (akaTurmas.length > 0) {
    const { data: matriculas } = await supabase.from('matriculas')
      .select('aluno_id, status')
      .in('turma_id', akaTurmas.map(t => t.id));
    
    console.log("Matriculas na AKA Dojo:", matriculas.length);
    const ativas = matriculas.filter(m => m.status && m.status.toLowerCase().includes('ativ'));
    console.log("Matriculas ATIVAS na AKA Dojo:", ativas.length);
  } else {
      console.log("Nenhuma turma AKA Dojo encontrada!");
  }
}
run();
