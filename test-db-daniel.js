import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Encontrar o Daniel
  const { data: alunos } = await supabase.from('alunos').select('id, nome_completo').ilike('nome_completo', '%Daniel%Catarino%');
  console.log("Alunos:", alunos);

  if (alunos.length > 0) {
      const daniel = alunos[0];
      // Ver as inscricoes dele
      const { data: inscricoes } = await supabase.from('evento_inscricoes').select('*').eq('aluno_id', daniel.id);
      console.log("Inscricoes do Daniel pelo aluno_id:", inscricoes);
      
      // Ver todas as inscricoes onde o nome dele aparece
      const { data: inscricoes_nome } = await supabase.from('evento_inscricoes').select('*').ilike('nome_aluno', '%Daniel%Catarino%');
      console.log("Inscricoes do Daniel pelo nome_aluno:", inscricoes_nome);
  }
}
run();
