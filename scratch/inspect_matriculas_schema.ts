import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  console.log("=== INSPECTING matriculas TABLE ===");
  const { data: rows, error } = await supabase
    .from('matriculas')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching matriculas:", error);
    return;
  }

  if (rows && rows.length > 0) {
    console.log("Keys of matricula row:");
    console.log(Object.keys(rows[0]));
    console.log("Sample matricula details:", JSON.stringify(rows[0], null, 2));
  } else {
    console.log("No matriculas found.");
  }
}

run();
