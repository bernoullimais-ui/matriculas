import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: wix } = await supabase.from('pagamentos_wix').select('*').limit(1);
  if (wix && wix.length > 0) {
    console.log("Keys in pagamentos_wix table:", Object.keys(wix[0]));
  }
}
check();
