import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('website_configs').select('*');
  console.log('Select:', error || data);
  
  const payload = { banner_title: 'Test' };
  const { error: err } = await supabase.from('website_configs').upsert({ id: data[0]?.id, ...payload });
  console.log('Upsert:', err || 'Success');
}

test();
