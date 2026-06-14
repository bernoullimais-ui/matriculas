import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: events, error } = await supabase.from('eventos').select('*').limit(5);
  if (error) {
    console.error('Error fetching events:', error);
    return;
  }
  for (const ev of events || []) {
    console.log(`Event: ${ev.titulo}`);
    console.log('  campos_personalizados:', typeof ev.campos_personalizados, ev.campos_personalizados);
    console.log('  categorias_inscricao:', typeof ev.categorias_inscricao, ev.categorias_inscricao);
    console.log('  opcoes_precos:', typeof ev.opcoes_precos, ev.opcoes_precos);
  }
}

main().catch(console.error);
