import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data, error } = await supabase.from('tarefas').select('*').eq('status', 'pendente').limit(5);
  console.log(JSON.stringify(data, null, 2));
}
check();
