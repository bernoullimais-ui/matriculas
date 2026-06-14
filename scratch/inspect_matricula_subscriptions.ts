import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  console.log("=== CHECKING pagarme_subscription_id IN matriculas ===");
  const { data: mats, error } = await supabase
    .from('matriculas')
    .select('id, aluno_id, plano, status, pagarme_subscription_id')
    .not('pagarme_subscription_id', 'is', null);

  if (error) {
    console.error("Error fetching matriculas:", error);
    return;
  }

  console.log(`Found ${mats?.length || 0} matriculas with pagarme_subscription_id.`);
  if (mats && mats.length > 0) {
    console.table(mats.slice(0, 20));
  }
}

run();
