import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const fetchAllFromSupabase = async (table: string, selectFields = '*') => {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (!count) {
    const { data } = await supabase.from(table).select(selectFields);
    return data || [];
  }
  const pageSize = 1000;
  const totalPages = Math.ceil(count / pageSize);
  const promises = [];
  for (let i = 0; i < totalPages; i++) {
    promises.push(supabase.from(table).select(selectFields).range(i * pageSize, (i + 1) * pageSize - 1));
  }
  const results = await Promise.all(promises);
  let allData: any[] = [];
  for (const res of results) {
    if (res.data) allData = allData.concat(res.data);
  }
  return allData;
};

async function run() {
  const loja = await fetchAllFromSupabase('loja_pedidos', 'total, status, provedor_pagamento, created_at');
  const eventos = await fetchAllFromSupabase('evento_inscricoes', 'valor_pago, status, taxa_paga, provedor_pagamento, created_at');
  
  console.log('Loja fields:', Object.keys(loja[0] || {}));
  console.log('Eventos fields:', Object.keys(eventos[0] || {}));
}

run().catch(console.error);
