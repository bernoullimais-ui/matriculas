import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function test() {
  const emails = ['tauanacoutinho@gmail.com', 'trindadelivia@hotmail.com'];
  for (const email of emails) {
    const { data: a } = await supabase.from('alunos').select('id, nome_completo, email, responsavel_id').ilike('email', email);
    console.log(`Alunos with email ${email}:`, a);
    
    // Maybe search by name?
    const namePart = email === 'tauanacoutinho@gmail.com' ? 'Tauana' : 'Livia';
    const { data: aName } = await supabase.from('alunos').select('id, nome_completo, email, responsavel_id').ilike('nome_completo', `%${namePart}%`);
    console.log(`Alunos with name ${namePart}:`, aName);
  }
}
test();
