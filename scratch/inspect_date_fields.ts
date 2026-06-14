import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const ids = [
    "1ed2de1d-5e7c-4d4f-8c61-0badfbadae4a",
    "5c3071be-8eb1-427d-bfbe-b393053f1482",
    "959a8bda-a264-4469-bbc8-e50bc22051b8",
    "213305d5-38bb-4df7-8b7d-b70925e3b204",
    "9351b36c-1045-4af0-99d0-3973db398091",
    "d916b543-a378-4e74-81d6-590e40647e0b"
  ];

  const { data, error } = await supabase
    .from('pagamentos')
    .select('id, data_pagamento, data_vencimento, created_at, valor, pagarme')
    .in('id', ids);

  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
