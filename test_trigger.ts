import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: inserted, error: insertError } = await supabase.from('cupons').insert([
    {
      codigo: 'TESTE_TRIGGER',
      nome: 'TESTE_TRIGGER',
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
  
  if (insertError) {
    console.error('Insert error:', insertError);
    return;
  }
  
  console.log('Inserted:', inserted);
  
  // wait 1 sec to let any async triggers run
  await new Promise(r => setTimeout(r, 1000));
  
  const { data: selected, error: selectError } = await supabase.from('cupons').select('limite_por_usuario').eq('codigo', 'TESTE_TRIGGER');
  console.log('Selected after 1 sec:', selected);
  
  await supabase.from('cupons').delete().eq('codigo', 'TESTE_TRIGGER');
}
test();
