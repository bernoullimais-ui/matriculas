import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: payments } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .or('cobranca_nome.ilike.%Pellenz%,cobranca_email.ilike.%pellenz%')
    .order('data_pagamento_gmt_03', { ascending: true });

  if (!payments) return;

  console.log('Existing payments count:', payments.length);

  // Find duplicates for student, month, plan
  const groups = new Map<string, any[]>();
  payments.forEach(row => {
    const studentOrEmail = row.aluno_id || (row.cobranca_email || '').toLowerCase().trim();
    const date = row.data_pagamento_gmt_03 || row.data_transacao_gmt_03 || '';
    const month = date.substring(0, 7);
    const plan = String(row.produto_nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
    const key = `${studentOrEmail}|${month}|${plan}`;

    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  });

  const toDelete: string[] = [];
  groups.forEach((list, key) => {
    if (list.length > 1) {
      console.log(`Conflict group: ${key}`);
      list.sort((a, b) => {
        const isCronA = a.provedor_pagamento === 'Wix API Cron' || String(a.id_provedor_pagamento).includes('-cycle-');
        const isCronB = b.provedor_pagamento === 'Wix API Cron' || String(b.id_provedor_pagamento).includes('-cycle-');
        if (isCronA && !isCronB) return 1;
        if (!isCronA && isCronB) return -1;
        const statusA = (a.status_transacao || '').toLowerCase();
        const statusB = (b.status_transacao || '').toLowerCase();
        const isFailA = statusA.includes('falh') || statusA.includes('recus');
        const isFailB = statusB.includes('falh') || statusB.includes('recus');
        if (isFailA && !isFailB) return 1; // Prioritize keeping Bem-sucedido first!
        if (!isFailA && isFailB) return -1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const keep = list[0];
      const dups = list.slice(1);
      console.log(`  KEEPING: id=${keep.id}, date=${keep.data_pagamento_gmt_03}, status=${keep.status_transacao}, provider=${keep.provedor_pagamento}`);
      dups.forEach(d => {
        console.log(`  DELETING: id=${d.id}, date=${d.data_pagamento_gmt_03}, status=${d.status_transacao}, provider=${d.provedor_pagamento}`);
        toDelete.push(d.id);
      });
    }
  });

  if (toDelete.length > 0) {
    console.log(`Deleting ${toDelete.length} records...`);
    const { error } = await supabase.from('pagamentos_wix').delete().in('id', toDelete);
    if (error) {
      console.error('Delete error:', error);
    } else {
      console.log('Deleted successfully!');
    }
  } else {
    console.log('No duplicates found.');
  }
}
run();
