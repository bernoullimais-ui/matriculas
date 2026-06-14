import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.from('cupons').insert([{
    codigo: 'TESTE123',
    nome: 'TESTE123',
    tipo_desconto: 'porcentagem',
    tipo: 'porcentagem',
    aplicar_em: 'todas_parcelas',
    valor: 10,
    escopo: 'loja_todos'
  }]).select();
  console.log("Error 1:", error?.message);

  const { data: d2, error: e2 } = await supabase.from('cupons').insert([{
    codigo: 'TESTE1234',
    nome: 'TESTE1234',
    tipo_desconto: 'valor_fixo',
    tipo: 'valor',
    aplicar_em: 'todas_parcelas',
    valor: 10,
    escopo: 'loja_todos'
  }]).select();
  console.log("Error 2:", e2?.message);
}
run();
