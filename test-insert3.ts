import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.from('cupons').insert([{
    codigo: 'TESTE123',
    nome: 'TESTE123',
    tipo_desconto: 'porcentagem',
    tipo: 'percentual',
    aplicar_em: 'todas_parcelas',
    data_inicio: new Date().toISOString().split('T')[0],
    valor: 10,
    escopo: 'loja_todos'
  }]).select();
  console.log("Error:", error?.message);
  console.log("Data:", data);
  if (!error) {
    await supabase.from('cupons').delete().eq('codigo', 'TESTE123');
  }
}
run();
