import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await supabase.from('responsaveis').select('id, nome_completo, celular').ilike('email', `lysdayanna@hotmail.com`).maybeSingle();
  console.log('maybeSingle data:', data);
  console.log('maybeSingle error:', error);
}
main();
