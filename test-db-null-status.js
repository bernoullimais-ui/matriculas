import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: matriculas } = await supabase.from('matriculas').select('id, status');
  const nullStatus = matriculas.filter(m => !m.status);
  console.log("Total matriculas:", matriculas.length);
  console.log("Matriculas com status null/vazio:", nullStatus.length);
}
run();
