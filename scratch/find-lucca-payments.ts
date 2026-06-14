import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function search() {
  console.log("=== SEARCHING FOR LUCCA PETERS REIS ===");
  
  // Find responsavel
  const { data: resps } = await supabase
    .from('responsaveis')
    .select('*')
    .ilike('nome_completo', '%Mariana Peters%');
  
  console.log("Responsaveis found:", resps);

  const { data: als } = await supabase
    .from('alunos')
    .select('*')
    .ilike('nome_completo', '%Lucca%');
  
  console.log("Alunos found:", als);

  if (als && als.length > 0) {
    const alunoIds = als.map(a => a.id);
    
    // Search in pagamentos
    const { data: pags } = await supabase
      .from('pagamentos')
      .select('*')
      .in('responsavel_id', resps?.map(r => r.id) || []);
    
    console.log("Standard payments:", pags);

    // Search in pagamentos_wix
    const { data: wixPags } = await supabase
      .from('pagamentos_wix')
      .select('*')
      .in('responsavel_id', resps?.map(r => r.id) || []);

    console.log("Wix payments:", wixPags);
  }
}

search();
