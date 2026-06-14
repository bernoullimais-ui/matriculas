import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  console.log("=== INSPECTING pagamentos TABLE SCHEMA ===");
  
  // Fetch columns and some rows
  const { data: rows, error } = await supabase
    .from('pagamentos')
    .select('*')
    .limit(3);

  if (error) {
    console.error("Error fetching from pagamentos:", error);
    return;
  }

  console.log("Sample rows in 'pagamentos' table:");
  console.log(JSON.stringify(rows, null, 2));
}

run();
