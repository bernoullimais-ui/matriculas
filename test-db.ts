import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key defined:", !!supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== TURMAS ===");
  const { data: tData, error: tErr } = await supabase.from('turmas').select('*').limit(1);
  if (tErr) console.error("Turmas Error:", tErr);
  else console.log("Turmas Columns:", Object.keys(tData?.[0] || {}), "\nSample:", tData?.[0]);

  console.log("=== UNIDADES ===");
  const { data: uData, error: uErr } = await supabase.from('unidades').select('*').limit(3);
  if (uErr) console.error("Unidades Error:", uErr);
  else console.log("Unidades Columns:", Object.keys(uData?.[0] || {}), "\nSamples:", uData);

  console.log("=== SERIES ANOS ===");
  const { data: sData, error: sErr } = await supabase.from('series_anos').select('*').limit(1);
  if (sErr) console.error("Series Error:", sErr);
  else console.log("Series Columns:", Object.keys(sData?.[0] || {}), "\nSample:", sData?.[0]);
}

run();
