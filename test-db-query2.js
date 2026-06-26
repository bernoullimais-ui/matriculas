import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: alunos } = await supabase.from('alunos').select('unidade, status_matricula');
  const aka = alunos.filter(a => a.unidade && a.unidade.toLowerCase().includes('aka'));
  console.log("Alunos AKA Dojo:", aka.length);
  const ativas = aka.filter(a => a.status_matricula && a.status_matricula.toLowerCase().includes('ativ'));
  console.log("Alunos AKA Dojo ATIVOS:", ativas.length);
}
run();
