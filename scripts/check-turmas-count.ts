import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { count, error } = await supabase.from('turmas').select('*', { count: 'exact', head: true });
  console.log('Turmas count:', count);
  console.log('Error:', error?.message);
}
check();
