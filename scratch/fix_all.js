import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: responsaveis } = await supabase.from('responsaveis').select('*');
  let fixedCount = 0;
  for (const r of responsaveis) {
    const trimmedCpf = r.cpf ? r.cpf.trim() : r.cpf;
    const trimmedEmail = r.email ? r.email.trim() : r.email;
    if (r.cpf !== trimmedCpf || r.email !== trimmedEmail) {
      console.log(`Fixing ${r.id}...`);
      await supabase.from('responsaveis').update({ cpf: trimmedCpf, email: trimmedEmail }).eq('id', r.id);
      fixedCount++;
    }
  }
  console.log(`Fixed ${fixedCount} records.`);
}
run();
