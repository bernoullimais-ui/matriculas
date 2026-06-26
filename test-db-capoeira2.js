import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: turmas } = await supabase.from('turmas').select('*');
  const capoeira = turmas.filter(t => t.nome.toLowerCase().includes('capoeira'));

  const turmaIds = capoeira.map(t => t.id);
  const { data: matriculas } = await supabase.from('matriculas').select('status, unidade').in('turma_id', turmaIds);
  
  console.log("Total matrículas em Capoeira:", matriculas.length);
  
  const naEscola = matriculas.filter(m => m.unidade && m.unidade.toLowerCase().includes('escola dom pedrinho'));
  console.log("Em Escola Dom Pedrinho:", naEscola.length);
  
  const ativas = naEscola.filter(m => m.status && ['ativo', 'ativa'].includes(m.status.toLowerCase()));
  console.log("Ativas na Escola Dom Pedrinho:", ativas.length);
}
run();
