import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('identidades')
    .select('wa_official_waba_id')
    .limit(1);

  if (error) console.error(error);
  else console.log(data);
}
main();
