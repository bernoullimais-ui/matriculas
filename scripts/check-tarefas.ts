import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data, error } = await supabase.from('tarefas').select('*');
  console.log('Tarefas:', data?.length);
  console.log('Tarefas pendentes:', data?.filter(t => t.status === 'pendente').length);
}
check();
