require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  const respId = 'e0d7d366-1722-4919-b737-6eed2f258587';
  
  const records = [
    {
      matricula_id: '2f0879e1-99bc-4e5b-9cf1-529e5778570c', // Gabriel
      aluno_id: '041b61fd-be75-4328-ac4b-c5c7b6270c7d',
      responsavel_id: respId,
      valor: 271.80,
      metodo_pagamento: 'cartao_credito',
      status: 'falha',
      data_vencimento: '2026-05-06T12:00:00Z',
      pagarme: 'ch_mLDmkX1fG01drAQZ'
    },
    {
      matricula_id: '2f0879e1-99bc-4e5b-9cf1-529e5778570c',
      aluno_id: '041b61fd-be75-4328-ac4b-c5c7b6270c7d',
      responsavel_id: respId,
      valor: 271.80,
      metodo_pagamento: 'cartao_credito',
      status: 'falha',
      data_vencimento: '2026-06-06T12:00:00Z',
      pagarme: 'ch_GRE2V4M11SUPQgk6'
    },
    {
      matricula_id: '2f0879e1-99bc-4e5b-9cf1-529e5778570c',
      aluno_id: '041b61fd-be75-4328-ac4b-c5c7b6270c7d',
      responsavel_id: respId,
      valor: 271.80,
      metodo_pagamento: 'cartao_credito',
      status: 'falha',
      data_vencimento: '2026-07-06T12:00:00Z',
      pagarme: 'ch_RDgEPHWGH1Ud1wPV'
    },
    {
      matricula_id: '5273ec62-66e3-42e2-a2e2-a2a160e3fb93', // Arthur
      aluno_id: 'b4b7eb7a-b1c5-418b-bcfa-cf46e6ea6cd3',
      responsavel_id: respId,
      valor: 271.80,
      metodo_pagamento: 'cartao_credito',
      status: 'falha',
      data_vencimento: '2026-04-30T12:00:00Z',
      pagarme: 'ch_EDxGxE1Gmd1uZEWxX'
    },
    {
      matricula_id: '5273ec62-66e3-42e2-a2e2-a2a160e3fb93',
      aluno_id: 'b4b7eb7a-b1c5-418b-bcfa-cf46e6ea6cd3',
      responsavel_id: respId,
      valor: 1.00,
      metodo_pagamento: 'cartao_credito',
      status: 'falha',
      data_vencimento: '2026-04-30T12:00:00Z',
      pagarme: 'ch_NMWQK1EH1fAQ0jDL'
    },
    {
      matricula_id: '5273ec62-66e3-42e2-a2e2-a2a160e3fb93',
      aluno_id: 'b4b7eb7a-b1c5-418b-bcfa-cf46e6ea6cd3',
      responsavel_id: respId,
      valor: 271.80,
      metodo_pagamento: 'cartao_credito',
      status: 'falha',
      data_vencimento: '2026-05-30T12:00:00Z',
      pagarme: 'ch_WfGkx2xn1HPUGjk8'
    },
    {
      matricula_id: '5273ec62-66e3-42e2-a2e2-a2a160e3fb93',
      aluno_id: 'b4b7eb7a-b1c5-418b-bcfa-cf46e6ea6cd3',
      responsavel_id: respId,
      valor: 1.00,
      metodo_pagamento: 'cartao_credito',
      status: 'falha',
      data_vencimento: '2026-05-30T12:00:00Z',
      pagarme: 'ch_g1UliB2J3BhA2E9G'
    },
    {
      matricula_id: '5273ec62-66e3-42e2-a2e2-a2a160e3fb93',
      aluno_id: 'b4b7eb7a-b1c5-418b-bcfa-cf46e6ea6cd3',
      responsavel_id: respId,
      valor: 271.80,
      metodo_pagamento: 'cartao_credito',
      status: 'falha',
      data_vencimento: '2026-06-30T12:00:00Z',
      pagarme: 'ch_JPMD4E1s1PQVXVAk'
    }
  ];

  for (const r of records) {
    // only insert if not exists
    const { data: existing } = await supabase.from('pagamentos').select('id').eq('pagarme', r.pagarme).maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('pagamentos').insert([r]);
      if (error) console.error("Error inserting", r.pagarme, error);
      else console.log("Inserted", r.pagarme);
    } else {
      console.log("Already exists", r.pagarme);
    }
  }
}
run();
