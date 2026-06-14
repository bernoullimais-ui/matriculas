import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  const { data: uData, error: uError } = await supabase.from('unidades').select('*').limit(1);
  if (uError) {
    console.error('Error fetching units:', uError);
  } else {
    console.log('Unidades columns:', Object.keys(uData?.[0] || {}));
    console.log('Sample unidade:', uData?.[0]);
  }

  const { data: tData, error: tError } = await supabase.from('turmas').select('*').limit(1);
  if (tError) {
    console.error('Error fetching turmas:', tError);
  } else {
    console.log('Turmas columns:', Object.keys(tData?.[0] || {}));
    console.log('Sample turma:', tData?.[0]);
  }
}

run();
