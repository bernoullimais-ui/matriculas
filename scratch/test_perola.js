import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: resp } = await supabase.from('responsaveis').select('*').eq('id', 'a551b9d5-59cb-4102-b775-368f7b01ad14');
  console.log("Resp:", resp);
}
run();
