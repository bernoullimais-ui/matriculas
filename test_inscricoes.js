require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('evento_inscricoes').select('id, nome_aluno, telefone_responsavel, whatsapp_responsavel, responsavel_id').limit(5);
  console.log('Inscricoes:', data);

  if (data && data.length > 0) {
    const { data: resp } = await supabase.from('responsaveis').select('id, telefone, celular').in('id', data.map(d => d.responsavel_id).filter(Boolean));
    console.log('Responsaveis:', resp);
  }
}
test();
