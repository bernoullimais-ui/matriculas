import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const r1 = await supabase.from('loja_pedidos').select('*, loja_produtos(*)').limit(1);
  console.log('Error:', r1.error);
}

run().catch(console.error);
