import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const payload: any = {
    codigo: 'TESTE_UNDEFINED',
    nome: 'TESTE_UNDEFINED',
    tipo_desconto: 'fixo',
    tipo: 'fixo',
    aplicar_em: 'todas_parcelas',
    data_inicio: new Date().toISOString().split('T')[0],
    valor: 10,
    ativo: true
  };
  
  const { data: inserted, error: insertError } = await supabase.from('cupons').insert([payload]).select();
  
  if (insertError) {
    console.error('Insert error:', insertError);
    return;
  }
  
  console.log('Inserted:', inserted);
  await supabase.from('cupons').delete().eq('codigo', 'TESTE_UNDEFINED');
}
test();
