import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const testCategory = {
    nome: 'Camisas',
    slug: 'camisas',
    descricao: 'Camisa por modalidade',
    ordem: 1
  };
  
  const { data, error } = await supabase.from('loja_categorias').insert([testCategory]).select();
  console.log('Result:', { data, error });
}

main().catch(console.error);
