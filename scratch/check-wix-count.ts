import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { count, error } = await supabase
    .from('pagamentos_wix')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error("Error fetching count:", error);
  } else {
    console.log(`Exact total count of rows in pagamentos_wix: ${count}`);
  }
}

check();
