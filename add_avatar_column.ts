import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const url = `${supabaseUrl}/rest/v1/rpc/exec_sql`;
  const sql = `ALTER TABLE conversas_whatsapp ADD COLUMN IF NOT EXISTS avatar_url TEXT;`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey
    },
    body: JSON.stringify({ query: sql })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Failed to alter table via rpc (maybe no exec_sql RPC?):', text);
    
    // Fallback: Use standard REST to try inserting a dummy to test if it's there
  } else {
    console.log('Successfully altered table.');
  }
}

main();
