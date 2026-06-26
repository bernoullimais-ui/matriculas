require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  const { data: matriculas, error } = await supabase
    .from('matriculas')
    .select('id, aluno_id, status, tipo_pagamento, motivo_excecao_pix, alunos(responsavel_id)');
    
  if (error) {
    console.error(error);
    return;
  }
  
  const pixMatriculas = matriculas.filter(m => m.tipo_pagamento === 'pix_excecao' || m.motivo_excecao_pix);
  console.log("Found pix_excecao matriculas:", pixMatriculas.length);
  
  let orphans = [];
  for (const mat of pixMatriculas) {
    const { data: pags } = await supabase.from('pagamentos').select('id').eq('matricula_id', mat.id);
    if (!pags || pags.length === 0) {
      orphans.push(mat.id);
    }
  }
  console.log("Orphaned matriculas:", orphans.length);
  if (orphans.length > 0) console.log("Example orphan:", orphans[0]);
}
check();
