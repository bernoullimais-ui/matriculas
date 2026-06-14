import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('Iniciando migração...');
  
  // 1. Ler o arquivo SQL
  const sqlPath = path.join(process.cwd(), 'supabase/migrations/20260604000000_create_loja_e_eventos.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Tentando executar migração SQL via RPC exec_sql...');
  const { data: rpcData, error: rpcError } = await supabase.rpc('exec_sql', { sql });

  if (rpcError) {
    console.error('Erro ao executar via RPC:', rpcError);
    console.log('\n--- ATENÇÃO ---');
    console.log('O RPC "exec_sql" não está disponível ou falhou.');
    console.log('Por favor, execute o conteúdo do arquivo SQL no SQL Editor do Painel do Supabase:');
    console.log(`https://supabase.com/dashboard/project/schzlvkeyggojleskkjy/sql`);
    console.log('---------------\n');
  } else {
    console.log('Migração executada com sucesso via RPC!', rpcData);
  }
  
  // 2. Verificar se as tabelas foram criadas
  const tables = ['loja_categorias', 'loja_produtos', 'loja_pedidos', 'loja_pedido_itens', 'eventos', 'evento_inscricoes'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`❌ Tabela ${table} não pôde ser acessada:`, error.message);
    } else {
      console.log(`✅ Tabela ${table} está acessível!`);
    }
  }
}

main().catch(console.error);
