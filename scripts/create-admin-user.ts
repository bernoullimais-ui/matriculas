import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const email = 'adm@sportforkids.com.br';
  const password = '@Bm250575';
  
  // Try to create the user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('User already exists, updating password...');
      const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
      if (!listError) {
        const user = usersData.users.find(u => u.email === email);
        if (user) {
          const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password });
          if (updateError) {
            console.error('Failed to update password:', updateError);
          } else {
            console.log('User password updated successfully.');
          }
        }
      }
    } else {
      console.error('Error creating user:', error);
    }
  } else {
    console.log('Admin user created successfully:', data.user.id);
  }
}
main();
