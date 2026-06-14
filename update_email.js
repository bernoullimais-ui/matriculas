import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const u1 = usersData.users.find(u => u.email === 'samia@sfk-system.com');
  const u2 = usersData.users.find(u => u.email === 'samia@sportforkids.com.br');
  console.log('samia@sfk-system.com exists:', !!u1);
  console.log('samia@sportforkids.com.br exists:', !!u2);
}

main();
