import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const sql = `ALTER TABLE cupons ADD COLUMN IF NOT EXISTS turma_id uuid REFERENCES turmas(id) ON DELETE SET NULL;`;
  console.log("Executing SQL...");
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error("SQL execution failed:", error);
  } else {
    console.log("SQL executed successfully! Return:", data);
  }
}
run();
