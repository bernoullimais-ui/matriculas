import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data, error } = await supabase.from('usuarios').select('*');
  if (error) {
    console.error('Error fetching usuarios:', error);
  } else {
    console.log('Usuarios found:', data.length);
    console.log('Columns:', Object.keys(data[0] || {}));
    console.log('First 5 rows:');
    console.log(JSON.stringify(data.slice(0, 10), null, 2));
  }
}
run();
