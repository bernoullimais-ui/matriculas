const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: a } = await supabase.from('alunos').select('id, nome_completo, unidade, status_matricula, plano, responsavel_1').limit(1);
  console.log('Aluno:', a[0]);
}
test();
