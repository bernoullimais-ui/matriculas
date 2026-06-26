const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: prods } = await supabase.from('loja_produtos').select('id, nome, slug').limit(2);
  const { data: evts } = await supabase.from('eventos').select('id, titulo, slug').limit(2);
  console.log("Produtos:", prods);
  console.log("Eventos:", evts);
}
test();
