import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const emailToFind = 'adm@sportforkids.com.br';
  
  // 1. Check in Auth
  console.log('Searching in Supabase Auth...');
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Auth error:', authError);
  } else {
    const authUser = users.find(u => u.email?.toLowerCase() === emailToFind.toLowerCase());
    if (authUser) {
      console.log('User found in Auth:', {
        id: authUser.id,
        email: authUser.email,
        metadata: authUser.user_metadata,
        created_at: authUser.created_at
      });
    } else {
      console.log('User NOT found in Auth.');
    }
  }

  // 2. Check in database usuarios table
  console.log('\nSearching in database usuarios table...');
  const { data: dbUsers, error: dbError } = await supabase
    .from('usuarios')
    .select('*');
    
  if (dbError) {
    console.error('DB error:', dbError);
  } else {
    // Check by email or auth_id or similar
    // Since usuarios table doesn't have an email column directly in the first 5 rows (it had login, nome, auth_id, etc.)
    // Let's list any rows that match or seem relevant
    const matchedUsers = dbUsers.filter(u => 
      (u.login && u.login.toLowerCase().includes('adm')) || 
      (u.nome && u.nome.toLowerCase().includes('adm'))
    );
    console.log('Matches in usuarios table:', matchedUsers);
    
    // Also print all dbUsers logins and names just to see
    console.log('\nAll registered logins and names in usuarios:');
    dbUsers.forEach(u => {
      console.log(`- Nome: ${u.nome}, Login: ${u.login}, Nível: ${u.nivel}, AuthID: ${u.auth_id}`);
    });
  }
}
run();
