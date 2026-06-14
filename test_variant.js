import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: prod } = await supabase.from('loja_produtos').select('*').limit(1).single();
  if (!prod) return console.log('No prod');
  
  const originalVars = prod.variantes;
  const originalEstoque = prod.estoque_por_variante;
  console.log('Original variantes:', originalVars);
  
  // Try to update
  const newVars = [{ tipo: 'Cor', opcoes: ['Vermelho', 'Azul'] }];
  const { data: updated, error } = await supabase.from('loja_produtos')
    .update({ variantes: newVars })
    .eq('id', prod.id)
    .select('variantes')
    .single();
    
  if (error) console.error('Error updating:', error);
  else console.log('Updated variantes:', updated.variantes);
  
  // Revert
  await supabase.from('loja_produtos').update({ variantes: originalVars }).eq('id', prod.id);
  console.log('Reverted');
}

main();
