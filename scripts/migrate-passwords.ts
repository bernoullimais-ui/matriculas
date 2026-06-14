/**
 * migrate-passwords.ts
 * ──────────────────────────────────────────────────────────────
 * Script ONE-SHOT para migrar senhas em plaintext da tabela
 * `responsaveis` para bcrypt hash.
 *
 * EXECUTE APENAS UMA VEZ em produção.
 * Senhas que já são bcrypt ($2b$ / $2a$) são automaticamente ignoradas.
 *
 * Como rodar:
 *   npx tsx scripts/migrate-passwords.ts
 *
 * Requer as variáveis de ambiente do arquivo .env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BCRYPT_ROUNDS = 10;
const BATCH_SIZE = 50;

async function main() {
  console.log('🔐 Iniciando migração de senhas para bcrypt...\n');

  let totalProcessed = 0;
  let totalHashed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let offset = 0;

  while (true) {
    // Busca lote de responsáveis com senha preenchida
    const { data: responsaveis, error } = await supabase
      .from('responsaveis')
      .select('id, nome_completo, senha')
      .not('senha', 'is', null)
      .neq('senha', '')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('❌ Erro ao buscar responsáveis:', error.message);
      break;
    }

    if (!responsaveis || responsaveis.length === 0) {
      break; // Fim dos registros
    }

    for (const r of responsaveis) {
      totalProcessed++;

      // Pula senhas que já são bcrypt
      if (r.senha.startsWith('$2b$') || r.senha.startsWith('$2a$')) {
        totalSkipped++;
        continue;
      }

      try {
        const hashed = await bcrypt.hash(r.senha, BCRYPT_ROUNDS);
        const { error: updateError } = await supabase
          .from('responsaveis')
          .update({ senha: hashed })
          .eq('id', r.id);

        if (updateError) {
          console.error(`  ❌ Erro ao atualizar ${r.nome_completo} (${r.id}):`, updateError.message);
          totalErrors++;
        } else {
          totalHashed++;
          process.stdout.write(`  ✅ ${r.nome_completo} migrado\r`);
        }
      } catch (err: any) {
        console.error(`  ❌ Exceção ao processar ${r.nome_completo}:`, err.message);
        totalErrors++;
      }
    }

    offset += BATCH_SIZE;

    // Pequena pausa para não sobrecarregar o banco
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n\n──────────────────────────────────────────');
  console.log('📊 RELATÓRIO DE MIGRAÇÃO:');
  console.log(`   Total processados : ${totalProcessed}`);
  console.log(`   ✅ Hasheados       : ${totalHashed}`);
  console.log(`   ⏭  Já eram bcrypt  : ${totalSkipped}`);
  console.log(`   ❌ Erros           : ${totalErrors}`);
  console.log('──────────────────────────────────────────');

  if (totalErrors === 0) {
    console.log('\n🎉 Migração concluída com sucesso! Todas as senhas estão seguras.');
  } else {
    console.log(`\n⚠️  ${totalErrors} senhas não foram migradas. Verifique os erros acima.`);
  }
}

main().catch(console.error);
