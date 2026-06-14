import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const authId = '63288eac-1f90-4eca-95ff-93bbdb8cfe35'; // adm@sportforkids.com.br
  
  // Try to find if this auth_id is already in the database
  const { data: existing, error: fetchError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching existing user:', fetchError);
    return;
  }

  if (existing) {
    console.log('User already exists in db, updating to Gestor Master...', existing);
    const { data: updated, error: updateError } = await supabase
      .from('usuarios')
      .update({
        nivel: 'Gestor Master',
        ativo: true
      })
      .eq('id', existing.id)
      .select();
      
    if (updateError) {
      console.error('Error updating user:', updateError);
    } else {
      console.log('User updated successfully:', updated);
    }
  } else {
    console.log('User not found in db, creating new profile...');
    const { data: inserted, error: insertError } = await supabase
      .from('usuarios')
      .insert([{
        nome: 'Administrador SFK',
        login: 'adm_sfk',
        senha: 'Ber2026_dummy',
        unidade: 'Master',
        nivel: 'Gestor Master',
        auth_id: authId,
        ativo: true,
        created_at: new Date().toISOString()
      }])
      .select();

    if (insertError) {
      console.error('Error inserting user:', insertError);
    } else {
      console.log('User inserted successfully:', inserted);
    }
  }
}
run();
