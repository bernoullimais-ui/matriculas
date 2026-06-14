import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function test() {
  const { data: a } = await supabase.from('alunos').select('id, nome_completo, email').eq('id', 'fa128248-30cb-44bc-88d9-8ba6027d7166');
  console.log("Lucca:", a);
}
test();
