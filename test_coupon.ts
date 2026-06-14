import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('cupons').insert([
    {
      codigo: 'TESTE_NULL_DEFAULT',
      nome: 'TESTE_NULL_DEFAULT',
      tipo_desconto: 'fixo',
      tipo: 'fixo',
      aplicar_em: 'todas_parcelas',
      data_inicio: new Date().toISOString().split('T')[0],
      valor: 10,
      ativo: true,
      limite_por_usuario: null,
      limite_total_uso: null
    }
  ]).select();
  console.log('Inserted coupon with nulls:', data);
  console.log('Error:', error);
  
  // clean up
  if (data) {
    await supabase.from('cupons').delete().eq('codigo', 'TESTE_NULL_DEFAULT');
  }
}
test();
