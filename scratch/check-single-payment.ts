import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: pay } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .eq('id', '80830f07-2f24-4a35-896e-1e617d70543f')
    .single();

  console.log("Payment details:", pay);
  if (pay?.responsavel_id) {
    const { data: resp } = await supabase.from('responsaveis').select('*').eq('id', pay.responsavel_id).single();
    console.log("Responsavel details:", resp);
  }
  if (pay?.aluno_id) {
    const { data: aluno } = await supabase.from('alunos').select('*').eq('id', pay.aluno_id).single();
    console.log("Aluno details:", aluno);
  }
}

check();
