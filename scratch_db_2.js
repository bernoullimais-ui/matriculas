import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('turmas')
    .select('id, nome, unidade_nome')
    .ilike('unidade_nome', '%Colegio%');
    
  console.log("No accent:", data?.length);

  const { data: data2 } = await supabase
    .from('turmas')
    .select('id, nome, unidade_nome')
    .ilike('unidade_nome', '%Colégio%');
    
  console.log("With accent:", data2?.length);
}
test();
