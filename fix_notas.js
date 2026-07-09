import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: notas } = await supabase.from('notas_fiscais_fila').select('*').order('created_at', { ascending: true });
  
  // 1. Deduplicate
  const seenPagamentos = new Set();
  const toDelete = [];
  const toKeep = [];
  
  for (const nota of notas) {
    if (seenPagamentos.has(nota.pagamento_id)) {
      toDelete.push(nota.id);
    } else {
      seenPagamentos.add(nota.pagamento_id);
      toKeep.push(nota);
    }
  }
  
  if (toDelete.length > 0) {
    console.log(`Deletando ${toDelete.length} notas duplicadas...`);
    // Delete in chunks if needed, but here it's small
    for (let id of toDelete) {
       await supabase.from('notas_fiscais_fila').delete().eq('id', id);
    }
  }

  // 2. Fix empty ones
  let count = 0;
  for (const nota of toKeep) {
    let dadosEmissao = nota.dados_emissao || {};
    let updated = false;
    
    const pagamentoId = nota.pagamento_id;
    if (dadosEmissao.origin === 'loja') {
        const { data: pedido } = await supabase.from('loja_pedidos').select('nome_cliente, email_cliente, total, responsavel_id').eq('id', pagamentoId).maybeSingle();
        if (pedido) {
          dadosEmissao.nome = pedido.nome_cliente;
          dadosEmissao.email = pedido.email_cliente;
          if (!dadosEmissao.valor) dadosEmissao.valor = pedido.total;
          if (pedido.responsavel_id) {
             const { data: resp } = await supabase.from('responsaveis').select('cpf').eq('id', pedido.responsavel_id).maybeSingle();
             if (resp) dadosEmissao.cpf = resp.cpf;
          }
          updated = true;
        }
    } else if (dadosEmissao.origin === 'evento') {
        const { data: inscricao } = await supabase.from('evento_inscricoes').select('nome_responsavel, email_responsavel, valor_pago, respostas_personalizadas, responsavel_id').eq('id', pagamentoId).maybeSingle();
        if (inscricao) {
          dadosEmissao.nome = inscricao.nome_responsavel;
          dadosEmissao.email = inscricao.email_responsavel;
          if (!dadosEmissao.valor) dadosEmissao.valor = inscricao.valor_pago;
          
          let cpf = '';
          if (inscricao.respostas_personalizadas) {
            cpf = inscricao.respostas_personalizadas['CPF do Responsável'] || inscricao.respostas_personalizadas['CPF'];
          }
          if (!cpf && inscricao.responsavel_id) {
             const { data: resp } = await supabase.from('responsaveis').select('cpf').eq('id', inscricao.responsavel_id).maybeSingle();
             if (resp) cpf = resp.cpf;
          }
          dadosEmissao.cpf = cpf;
          updated = true;
        }
    } else if (dadosEmissao.origin === 'mensalidade_pix') {
      const { data: fatura } = await supabase.from('faturas_pix').select('valor, matricula_id').eq('id', pagamentoId).maybeSingle();
      if (fatura && fatura.matricula_id) {
        const { data: mat } = await supabase.from('matriculas').select('responsaveis(nome_completo, cpf, email)').eq('id', fatura.matricula_id).maybeSingle();
        const resp = mat?.responsaveis;
        if (resp) {
          dadosEmissao.nome = Array.isArray(resp) ? resp[0]?.nome_completo : resp.nome_completo;
          dadosEmissao.cpf = Array.isArray(resp) ? resp[0]?.cpf : resp.cpf;
          dadosEmissao.email = Array.isArray(resp) ? resp[0]?.email : resp.email;
          updated = true;
        }
      }
    } else if (dadosEmissao.origin === 'excecao_pix' || dadosEmissao.origin === 'geral') {
      let query = supabase.from('pagamentos').select('valor, responsavel_id');
      if (pagamentoId.includes('-')) { query = query.eq('id', pagamentoId); } else { query = query.eq('pagarme', pagamentoId); }
      const { data: pag } = await query.maybeSingle();
      if (pag && pag.responsavel_id) {
        const { data: resp } = await supabase.from('responsaveis').select('nome_completo, cpf, email').eq('id', pag.responsavel_id).maybeSingle();
        if (resp) { dadosEmissao.nome = resp.nome_completo; dadosEmissao.cpf = resp.cpf; dadosEmissao.email = resp.email; updated = true; }
      }
    }
    
    if (updated && dadosEmissao.nome && dadosEmissao.nome !== 'Não informado') {
      console.log('Atualizando nota:', nota.id, '->', dadosEmissao.nome);
      await supabase.from('notas_fiscais_fila').update({ dados_emissao: dadosEmissao }).eq('id', nota.id);
      count++;
    } else if (!dadosEmissao.nome || dadosEmissao.nome === 'Não informado') {
      console.log('Removendo órfão:', nota.id);
      await supabase.from('notas_fiscais_fila').delete().eq('id', nota.id);
    }
  }
  console.log('Total atualizados:', count);
}
run();
