require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  const { data: matriculas } = await supabase.from('matriculas').select('*').order('created_at', { ascending: false }).limit(1);
  if (!matriculas || matriculas.length === 0) return console.log("No matriculas");
  const matricula = matriculas[0];
  
  const { data, error } = await supabase.from('pagamentos').insert([{
        responsavel_id: matricula.responsavel_id,
        matricula_id: matricula.id,
        valor: 100,
        status: 'pendente',
        metodo_pagamento: 'pix',
        pagarme: 'sub_xyz',
        data_vencimento: new Date().toISOString(),
        qr_code: "test",
        qr_code_url: "test"
  }]).select().single();
  console.log("Insert Error:", error);
  console.log("Insert Data:", data);
}
check();
