import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: matriculas } = await supabase.from('matriculas').select('id, data_matricula, data_cancelamento, status, aluno_id');
  
  let count = 0;
  for(let m of matriculas) {
     if(m.data_matricula && m.data_matricula.includes('2025-')) {
         if (m.data_cancelamento && m.data_cancelamento.includes('2025-')) {
            count++;
         }
     }
  }
  console.log("Matriculas que comecaram e cancelaram em 2025:", count);
}
run();
