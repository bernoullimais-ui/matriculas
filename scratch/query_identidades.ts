import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://schzlvkeyggojleskkjy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaHpsdmtleWdnb2psZXNra2p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzIxMzUsImV4cCI6MjA4NTU0ODEzNX0.lsZaoMCOQwrz26WYv4fX8hCxFw5wnZVAxO1wns-FhS4";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('identidades').select('*');
  console.log(JSON.stringify(data, null, 2));
  if (error) console.error(error);
}
run();
