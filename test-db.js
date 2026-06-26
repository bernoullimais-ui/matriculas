import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: alunos } = await supabase.from('alunos').select('unidade, status_matricula').limit(5);
  const { data: matriculas } = await supabase.from('matriculas').select('status').limit(5);
  console.log("Alunos:", alunos);
  console.log("Matriculas:", matriculas);
}
run();
