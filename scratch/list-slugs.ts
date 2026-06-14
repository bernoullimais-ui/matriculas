import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await supabase.from('loja_produtos').select('id, nome, slug');
  if (error) {
    console.error('Error fetching products:', error);
  } else {
    console.log('Current products in database:');
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
