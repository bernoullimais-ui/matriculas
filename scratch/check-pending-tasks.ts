import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase
    .from('tarefas')
    .select('*, alunos(nome_completo)')
    .eq('status', 'pendente');
    
  if (error) {
    console.error('Error fetching pending tasks:', error);
  } else {
    console.log('Pending Tasks:', JSON.stringify(data, null, 2));
  }
}
run();
