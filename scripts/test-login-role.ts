import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const email = 'adm@sportforkids.com.br';
  const password = '@Bm250575';
  
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Error logging in with service role:', error);
  } else {
    console.log('Login successful with service role:', data.session.access_token.substring(0, 20) + '...');
  }
}
main();
