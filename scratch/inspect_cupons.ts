import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('cupons')
    .select('*, cupom_usos(id)')
    .limit(5);
  
  if (data) {
    data.forEach(c => {
      console.log(`Cupom: ${c.codigo}, Usos count: ${c.cupom_usos?.length || 0}`);
    });
  } else {
    console.log('Error:', error);
  }
}
test();
