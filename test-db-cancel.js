import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: matriculas } = await supabase.from('matriculas').select('id, status, data_cancelamento').in('status', ['cancelado', 'cancelada', 'Cancelado', 'Cancelada']);
  const nullCancel = matriculas.filter(m => !m.data_cancelamento);
  console.log("Total cancelados:", matriculas.length);
  console.log("Cancelados sem data:", nullCancel.length);
}
run();
