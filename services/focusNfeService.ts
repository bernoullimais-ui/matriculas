import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
