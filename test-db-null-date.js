import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: matriculas } = await supabase.from('matriculas').select('id, data_matricula, created_at');
  const nullDate = matriculas.filter(m => !m.data_matricula);
  console.log("Total matriculas:", matriculas.length);
  console.log("Matriculas com data_matricula null:", nullDate.length);
}
run();
