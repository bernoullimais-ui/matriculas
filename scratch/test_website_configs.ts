import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase.from('website_configs').select('*').limit(1).maybeSingle();
  console.log("Current config:", data);
  if (error) console.log("Error selecting:", error);

  const payload = {
    ...data,
    header_logo_url: "https://example.com/logo.png"
  };

  if (data) {
    const { error: updError } = await supabase.from('website_configs').update(payload).eq('id', data.id);
    console.log("Update Error:", updError);
  }
}

run();
