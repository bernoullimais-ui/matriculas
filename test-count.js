import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { count: aCount } = await supabase.from('alunos').select('*', { count: 'exact', head: true });
  const { count: mCount } = await supabase.from('matriculas').select('*', { count: 'exact', head: true });
  console.log("Alunos:", aCount);
  console.log("Matriculas:", mCount);
}
run();
