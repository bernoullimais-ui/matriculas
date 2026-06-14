import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('pagamentos')
    .select('id, aluno_id, matricula_id, produto_nome, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(data, error);
}
main();
