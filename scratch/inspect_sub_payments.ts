import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const ids = [
    'in_mBkGVd9TvETw5PZo',
    'in_DZzRjbHN9FjeRKmA',
    'in_lJ1p22oFVNIAJpeW',
    'sub_VozyGnRWUeTnGK5Q'
  ];
  
  const { data: pagamentos, error } = await supabase
    .from('pagamentos')
    .select('*')
    .or(`pagarme.in.(${ids.join(',')})`);
    
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(pagamentos, null, 2));
  }
}

run();
