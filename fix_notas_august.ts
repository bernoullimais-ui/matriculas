import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { queueNotaFiscal, processarFilaNotasFiscais } from './services/focusNfeService.ts';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Buscando pagamentos do dia 01/08/2026...');
  const { data: pagamentos, error } = await supabase
    .from('pagamentos')
    .select('id, status, created_at, valor')
    .gte('created_at', '2026-08-01T00:00:00Z')
    .lt('created_at', '2026-08-02T00:00:00Z')
    .eq('status', 'pago');
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Encontrados ${pagamentos.length} pagamentos.`);
  
  for (const pag of pagamentos) {
    const { data: fila } = await supabase.from('notas_fiscais_fila').select('id').eq('pagamento_id', pag.id).maybeSingle();
    if (!fila) {
       console.log(`Enfileirando NFe para pagamento ${pag.id} (R$ ${pag.valor})`);
       await queueNotaFiscal(pag.id, 'NFSe', { origin: 'geral' });
    } else {
       console.log(`Pagamento ${pag.id} já possui NFe na fila.`);
    }
  }
  console.log('Iniciando processamento da fila...');
  await processarFilaNotasFiscais();
  console.log('Concluído!');
}
run();
