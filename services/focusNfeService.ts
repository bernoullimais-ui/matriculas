import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

let supabase: any;
if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("[Focus NFe] Supabase URL or Key is missing in environment variables. Using dummy client.");
  supabase = createClient("https://dummy.supabase.co", "dummy-key");
} else {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

const FOCUS_API_URL = process.env.FOCUS_NFE_API_URL || 'https://api.focusnfe.com.br/v2';
const FOCUS_API_TOKEN = process.env.FOCUS_NFE_API_TOKEN || '';

/**
 * Adiciona uma intenção de emissão de Nota Fiscal na fila
 */
export async function queueNotaFiscal(pagamentoId: string, tipoNota: 'NFSe' | 'NFe', dadosEmissao: any = {}) {
  try {
    const { data: existente } = await supabase
      .from('notas_fiscais_fila')
      .select('id')
      .eq('pagamento_id', pagamentoId)
      .maybeSingle();

    if (existente) {
      console.log(`[Focus NFe] Nota fiscal já enfileirada para o pagamento ${pagamentoId}`);
      return;
    }

    // Fetch customer data if missing based on origin
    if (!dadosEmissao.nome || !dadosEmissao.cpf) {
      if (dadosEmissao.origin === 'loja') {
        const { data: pedido } = await supabase.from('loja_pedidos').select('nome_cliente, email_cliente, total, responsavel_id, status').eq('id', pagamentoId).maybeSingle();
        if (pedido) {
          if (pedido.status !== 'pago') {
            console.log(`[Focus NFe] Cancelando fila para loja_pedidos ${pagamentoId} (status = ${pedido.status})`);
            return;
          }
          dadosEmissao.nome = pedido.nome_cliente;
          dadosEmissao.email = pedido.email_cliente;
          if (!dadosEmissao.valor) dadosEmissao.valor = pedido.total;
          if (pedido.responsavel_id) {
             const { data: resp } = await supabase.from('responsaveis').select('cpf').eq('id', pedido.responsavel_id).maybeSingle();
             if (resp) dadosEmissao.cpf = resp.cpf;
          }
        }
      } else if (dadosEmissao.origin === 'evento') {
        const { data: inscricao } = await supabase.from('evento_inscricoes').select('nome_responsavel, email_responsavel, valor_pago, respostas_personalizadas, responsavel_id, status').eq('id', pagamentoId).maybeSingle();
        if (inscricao) {
          if (inscricao.status !== 'confirmada') {
            console.log(`[Focus NFe] Cancelando fila para evento_inscricoes ${pagamentoId} (status = ${inscricao.status})`);
            return;
          }
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
        }
      } else if (dadosEmissao.origin === 'mensalidade_pix') {
        const { data: fatura } = await supabase.from('faturas_pix').select('valor, matricula_id, status').eq('id', pagamentoId).maybeSingle();
        if (fatura && fatura.matricula_id) {
          if (fatura.status !== 'pago') {
            console.log(`[Focus NFe] Cancelando fila para faturas_pix ${pagamentoId} (status = ${fatura.status})`);
            return;
          }
          const { data: mat } = await supabase.from('matriculas').select('responsaveis(nome_completo, cpf, email)').eq('id', fatura.matricula_id).maybeSingle();
          const resp = mat?.responsaveis;
          if (resp) {
            dadosEmissao.nome = Array.isArray(resp) ? resp[0]?.nome_completo : resp.nome_completo;
            dadosEmissao.cpf = Array.isArray(resp) ? resp[0]?.cpf : resp.cpf;
            dadosEmissao.email = Array.isArray(resp) ? resp[0]?.email : resp.email;
          }
          if (!dadosEmissao.valor) dadosEmissao.valor = fatura.valor;
        }
      } else if (dadosEmissao.origin === 'excecao_pix' || dadosEmissao.origin === 'geral') {
        let query = supabase.from('pagamentos').select('valor, responsavel_id, status');
        if (pagamentoId.includes('-')) {
           query = query.eq('id', pagamentoId);
        } else {
           query = query.eq('pagarme', pagamentoId);
        }
        const { data: pag } = await query.maybeSingle();
        if (pag) {
          if (pag.status !== 'pago') {
            console.log(`[Focus NFe] Cancelando fila para pagamentos ${pagamentoId} (status = ${pag.status})`);
            return;
          }
          if (pag.responsavel_id) {
            const { data: resp } = await supabase.from('responsaveis').select('nome_completo, cpf, email').eq('id', pag.responsavel_id).maybeSingle();
            if (resp) {
              dadosEmissao.nome = resp.nome_completo;
              dadosEmissao.cpf = resp.cpf;
              dadosEmissao.email = resp.email;
            }
          }
          if (!dadosEmissao.valor) dadosEmissao.valor = pag.valor;
        }
      }
    }

    const { error } = await supabase
      .from('notas_fiscais_fila')
      .insert({
        pagamento_id: pagamentoId,
        tipo_nota: tipoNota,
        status: 'pendente',
        dados_emissao: dadosEmissao
      });

    if (error) {
      console.error(`[Focus NFe] Erro ao enfileirar nota fiscal para ${pagamentoId}:`, error);
    } else {
      console.log(`[Focus NFe] Nota fiscal (${tipoNota}) enfileirada com sucesso para ${pagamentoId}`);
      
      // Checa a configuração
      const { data: config } = await supabase.from('configuracoes_nf').select('frequencia').limit(1).single();
      if (config?.frequencia === 'imediato') {
        // Dispara de forma assíncrona (fogo e esquece)
        processarFilaNotasFiscais().catch(console.error);
      }
    }
  } catch (err) {
    console.error(`[Focus NFe] Exceção ao enfileirar nota fiscal:`, err);
  }
}

/**
 * Processa a fila de notas fiscais pendentes (Lote)
 */
export async function processarFilaNotasFiscais() {
  console.log('[Focus NFe] Iniciando processamento em lote de notas fiscais...');
  
  // Buscar configuração
  const { data: config } = await supabase.from('configuracoes_nf').select('*').limit(1).single();
  
  if (config && config.frequencia !== 'imediato') {
    const today = new Date();
    // UTC to Brasília
    today.setHours(today.getHours() - 3);
    
    if (config.frequencia === 'semanal') {
      if (today.getDay() !== (config.dia_semana || 0)) {
        console.log(`[Focus NFe] Hoje não é o dia da semana configurado para processamento semanal (${config.dia_semana}). Abortando.`);
        return { success: true, count: 0, skipped: true };
      }
    } else if (config.frequencia === 'mensal') {
      if (today.getDate() !== (config.dia_mes || 1)) {
        console.log(`[Focus NFe] Hoje não é o dia do mês configurado para processamento mensal (${config.dia_mes}). Abortando.`);
        return { success: true, count: 0, skipped: true };
      }
    }
    // "diario" always proceeds since the cron runs daily (or we just let it run)
  }
  
  const { data: pendentes, error } = await supabase
    .from('notas_fiscais_fila')
    .select('*')
    .eq('status', 'pendente')
    .limit(50); // Processa em lotes de 50
    
  if (error) {
    console.error('[Focus NFe] Erro ao buscar notas pendentes:', error);
    return { error };
  }

  if (!pendentes || pendentes.length === 0) {
    console.log('[Focus NFe] Nenhuma nota pendente no momento.');
    return { success: true, count: 0 };
  }

  console.log(`[Focus NFe] Encontradas ${pendentes.length} notas pendentes.`);
  let processadas = 0;

  for (const nota of pendentes) {
    try {
      // 1. Marca como processando para evitar duplicidade em execuções concorrentes
      await supabase.from('notas_fiscais_fila').update({ status: 'processando' }).eq('id', nota.id);
      
      // 2. Monta o payload dependendo do tipo (NFSe ou NFe)
      // O payload real precisa ser ajustado com base nos dados do aluno/responsavel salvos no banco.
      // Simplificado para exemplo de integração:
      const payload = {
        natureza_operacao: "1", // Exemplo padrão
        prestador: {
          cnpj: "00000000000000", // CNPJ da Escola (Deve vir do ENV ou do banco)
          inscricao_municipal: "123456"
        },
        tomador: {
          cpf: nota.dados_emissao?.cpf || '00000000000',
          razao_social: nota.dados_emissao?.nome || 'Consumidor',
          email: nota.dados_emissao?.email,
          endereco: {
            logradouro: nota.dados_emissao?.rua,
            numero: nota.dados_emissao?.numero,
            bairro: nota.dados_emissao?.bairro,
            cep: nota.dados_emissao?.cep,
            codigo_municipio: "3550308", // Requer conversão ou busca correta do município IBGE
            uf: nota.dados_emissao?.uf
          }
        },
        servico: {
          aliquota: 3,
          item_lista_servico: "08.01",
          codigo_tributario_municipio: "0801",
          valor_servicos: nota.dados_emissao?.valor || 100.00
        }
      };

      const refId = `NF_${nota.id.replace(/-/g, '')}`;
      const endpoint = nota.tipo_nota === 'NFSe' ? `/nfse?ref=${refId}` : `/nfe?ref=${refId}`;
      const tokenAuth = Buffer.from(`${FOCUS_API_TOKEN}:`).toString('base64');

      // 3. Envia para a API da Focus
      const focusResponse = await axios.post(`${FOCUS_API_URL}${endpoint}`, payload, {
        headers: {
          'Authorization': `Basic ${tokenAuth}`,
          'Content-Type': 'application/json'
        }
      });

      // 4. Atualiza a fila com a referência retornada pela Focus
      await supabase.from('notas_fiscais_fila').update({ 
        status: 'processando_sefaz', 
        focus_id: refId
      }).eq('id', nota.id);
      
      processadas++;
    } catch (e: any) {
      console.error(`[Focus NFe] Falha ao enviar nota ${nota.id}:`, e.response?.data || e.message);
      await supabase.from('notas_fiscais_fila').update({ 
        status: 'erro',
        mensagem_erro: e.response?.data?.mensagem || e.message
      }).eq('id', nota.id);
    }
  }

  return { success: true, count: processadas };
}
