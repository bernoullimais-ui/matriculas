import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const sql = `
    -- Desabilitar RLS na tabela loja_kit_itens
    ALTER TABLE loja_kit_itens DISABLE ROW LEVEL SECURITY;

    -- Criar política de acesso público total caso RLS seja reativado ou forçado
    DROP POLICY IF EXISTS "Permitir tudo para loja_kit_itens" ON loja_kit_itens;
    CREATE POLICY "Permitir tudo para loja_kit_itens" ON loja_kit_itens FOR ALL USING (true) WITH CHECK (true);
  `;

  console.log('Executando comandos SQL no Supabase...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Erro ao executar SQL via RPC:', error);
    console.log('\n--- EXECUÇÃO MANUAL NECESSÁRIA ---');
    console.log('Execute o seguinte comando no SQL Editor do painel do Supabase:');
    console.log(sql);
    console.log('----------------------------------\n');
  } else {
    console.log('Comandos SQL executados com sucesso!', data);
  }
}

main().catch(console.error);
