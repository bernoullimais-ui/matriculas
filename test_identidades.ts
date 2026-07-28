import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: idents } = await supabase.from('identidades').select('*');
  console.log('Identidades:', idents?.map(i => ({ nome: i.nome, phone: i.utalk_from_phone })));
}
run();
