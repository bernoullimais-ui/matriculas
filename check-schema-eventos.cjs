const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: eventos, error: e1 } = await supabase.from('eventos').select('*').limit(1);
  console.log("Eventos table:", e1 ? e1.message : "Exists", eventos);

  const { data: inscricoes, error: e2 } = await supabase.from('evento_inscricoes').select('*').limit(1);
  console.log("Inscricoes table:", e2 ? e2.message : "Exists", inscricoes);
}
run();
