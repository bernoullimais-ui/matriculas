const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const targets = [{ tipo_alvo: 'unidade', valor_alvo: 'Colégio Bernoulli' }];
  
  let query = supabase.from('alunos').select('id, nome_completo, email, responsavel_id, unidade, status_matricula, plano, responsavel_1, contato, whatsapp_1').eq('unidade', 'Colégio Bernoulli').in('status_matricula', ['ativo', 'Ativo', 'Ativa', 'ativa']);
  
  const { data: alunos, error } = await query;
  if (error) { console.log("Error:", error); return; }
  console.log(`Found ${alunos.length} alunos with status_matricula in (ativo, Ativa...) in Colégio Bernoulli`);
  
  if (alunos.length > 0) {
    console.log("Sample aluno:", alunos[0]);
  }
}
run();
