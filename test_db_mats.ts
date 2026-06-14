import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function test() {
  const ids = ['eeb756d4-310d-4d4c-8c83-beabe4277b15', 'b27b50a6-b0c0-4c00-9130-74326b8e87e4'];
  for (const id of ids) {
    const { data: mats } = await supabase.from('matriculas').select('*').eq('aluno_id', id);
    console.log(`Aluno ${id} mats:`, mats);
  }
}
test();
