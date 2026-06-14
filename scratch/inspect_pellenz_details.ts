import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .eq('id', 'bff85e10-7fdd-426b-857b-0cae973b955f'); // Futsal 3 May payment for Pellenz

  console.log(JSON.stringify(data, null, 2));
}
run();
