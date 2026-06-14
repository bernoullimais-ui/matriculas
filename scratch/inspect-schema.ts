import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: eventCols, error: err1 } = await supabase.from('eventos').select('*').limit(1);
  if (err1) {
    console.error('Error fetching eventos:', err1);
  } else {
    console.log('Eventos columns:', Object.keys(eventCols[0] || {}));
  }

  const { data: inscricaoCols, error: err2 } = await supabase.from('evento_inscricoes').select('*').limit(1);
  if (err2) {
    console.error('Error fetching evento_inscricoes:', err2);
  } else {
    console.log('Evento_inscricoes columns:', Object.keys(inscricaoCols[0] || {}));
  }
}

main().catch(console.error);
