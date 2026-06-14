import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  const subId = 'sub_WmGBWDzSviE6rLx9';
  console.log(`Checking database for subscription ID: ${subId}`);
  
  // Check in matriculas
  const { data: mats, error: errMats } = await supabase
    .from('matriculas')
    .select('id, aluno_id, status, pagarme_subscription_id, alunos(nome_completo)')
    .eq('pagarme_subscription_id', subId);
    
  if (errMats) console.error("Error in matriculas query:", errMats);
  else console.log("Matriculas match:", JSON.stringify(mats, null, 2));

  // Check in pagamentos
  const { data: payments, error: errPayments } = await supabase
    .from('pagamentos')
    .select('id, valor, status, pagarme, matricula_id')
    .eq('pagarme', subId);

  if (errPayments) console.error("Error in pagamentos query:", errPayments);
  else console.log("Pagamentos match:", JSON.stringify(payments, null, 2));
}

run();
