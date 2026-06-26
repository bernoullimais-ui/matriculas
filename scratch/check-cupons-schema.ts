import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Nenhuma credencial Supabase configurada!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("Buscando um cupom para ver a estrutura de colunas...");
    const { data, error } = await supabase
      .from('cupons')
      .select('*')
      .limit(1);

    if (error) throw error;
    console.log("Colunas encontradas:");
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]));
      console.log("Exemplo de registro:", JSON.stringify(data[0], null, 2));
    } else {
      console.log("Tabela vazia. Tentando consultar a tabela pelo schema postgres...");
      const { data: cols, error: errCols } = await supabase.rpc('get_table_columns', { table_name: 'cupons' });
      if (errCols) {
        // Se rpc não existe, tenta inserir um registro temporário e depois dar rollback
        console.log("Tabela vazia e RPC indisponível. Vamos tentar fazer um select genérico.");
      } else {
        console.log("Colunas pelo RPC:", cols);
      }
    }
  } catch (err: any) {
    console.error("Erro ao verificar colunas:", err.message || err);
  }
}

run();
