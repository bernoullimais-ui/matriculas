const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: mats, error } = await supabase.from('matriculas').select('aluno_id, plano, status, turmas(nome)').limit(3);
  console.log('Mats:', mats, 'Error:', error);
}
test();
