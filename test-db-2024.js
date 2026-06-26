import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: matriculas } = await supabase.from('matriculas').select('data_matricula, status, created_at, data_cancelamento');
  let count2024 = 0;
  for(let m of matriculas) {
      if (m.data_matricula && m.data_matricula.includes('2024')) {
          count2024++;
      }
      else if (m.created_at && m.created_at.includes('2024')) {
          count2024++;
      }
  }
  console.log("Total matriculas:", matriculas.length);
  console.log("Matriculas em 2024:", count2024);
}
run();
