/**
 * sofia-agent.ts
 * 
 * Motor principal do Agente Sofia — Assistente Virtual via WhatsApp.
 * Gerencia sessões, processa mensagens com Gemini Function Calling,
 * persiste histórico e executa ferramentas.
 */

import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  SOFIA_TOOL_DECLARATIONS,
  executarFerramenta,
  SofiaToolContext
} from './sofia-tools.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos e Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface SofiaMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface ConversaWhatsapp {
  id: string;
  telefone: string;
  aluno_ids: string[];
  responsavel_nome: string | null;
  identidade_nome: string;
  historico: SofiaMessage[];
  status: 'ativo' | 'escalado' | 'encerrado';
  escalado_at: string | null;
  encerrado_at: string | null;
  ultima_mensagem_at: string;
  total_mensagens: number;
  created_at: string;
}

export interface SofiaConfig {
  identidadeNome: string;
  nomeAgente: string;           // Configurável por unidade (ex: "Sofia")
  utalkToken: string;
  utalkFromPhone: string;
  utalkOrganizationId: string;
  utalkUrl: string;
  adminWhatsapp?: string;       // Número do admin para notificação de escalamento
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const SESSAO_EXPIRACAO_HORAS = 8;
const MAX_TENTATIVAS_TOOL_LOOP = 10;
const HORARIO_COMERCIAL_INICIO = 8;  // 8h
const HORARIO_COMERCIAL_FIM = 18;    // 18h

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Normaliza telefone
// ─────────────────────────────────────────────────────────────────────────────

function normalizeTelefone(tel: string): string {
  return tel.replace(/\D/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Verifica horário comercial
// ─────────────────────────────────────────────────────────────────────────────

function isHorarioComercial(): boolean {
  const agora = new Date();
  const hora = agora.getHours();
  const diaSemana = agora.getDay(); // 0=Dom, 6=Sab
  return diaSemana >= 1 && diaSemana <= 6 &&
         hora >= HORARIO_COMERCIAL_INICIO &&
         hora < HORARIO_COMERCIAL_FIM;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Envia mensagem via UTalk
// ─────────────────────────────────────────────────────────────────────────────

async function enviarMensagemUTalk(
  paraPhone: string,
  mensagem: string,
  config: SofiaConfig
): Promise<boolean> {
  try {
    const telNorm = normalizeTelefone(paraPhone);
    const fromNorm = normalizeTelefone(config.utalkFromPhone);

    const payload = {
      toPhone: telNorm.startsWith('55') ? telNorm : `55${telNorm}`,
      fromPhone: fromNorm,
      organizationId: config.utalkOrganizationId,
      message: mensagem
    };

    const response = await fetch(config.utalkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.utalkToken}`,
        'token': config.utalkToken,
        'x-token': config.utalkToken
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Sofia] Erro UTalk ${response.status}:`, text);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[Sofia] Erro ao enviar via UTalk:', e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gera System Prompt dinâmico
// ─────────────────────────────────────────────────────────────────────────────

function gerarSystemPrompt(nomeAgente: string): string {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const horarioComercial = isHorarioComercial();

  return `Você é ${nomeAgente}, assistente virtual da Sport for Kids.
Seu papel é atender responsáveis de alunos com empatia, clareza e agilidade pelo WhatsApp.

DATA E HORA ATUAL: ${agora}
HORÁRIO COMERCIAL (8h-18h, seg-sáb): ${horarioComercial ? 'SIM (equipe disponível)' : 'NÃO (fora do horário comercial)'}

IDENTIDADE:
- Você é um assistente virtual — não finjas ser humana, mas seja calorosa e próxima
- Use linguagem descontraída mas profissional, como a de uma secretária simpática
- Responda SEMPRE em português brasileiro

REGRAS DE OURO:
1. NUNCA invente informações — use APENAS os dados retornados pelas ferramentas
2. Para ações que alteram dados (cancelamento, mudança de turma), SEMPRE confirme com o responsável antes de executar
3. Mantenha respostas CURTAS e diretas (WhatsApp não é e-mail — máximo 3-4 parágrafos por mensagem)
4. Use listas com "•" para informações estruturadas (horários, valores, etc.)
5. Emojis são bem-vindos com moderação: ✅ ❌ 📅 💰 🏃 👋
6. Se não souber ou a situação for complexa, escale para humano com motivo claro

FORA DO HORÁRIO COMERCIAL:
- Informe que a equipe retornará no próximo dia útil
- Continue atendendo consultas de informação (matrículas, horários, etc.)
- Para solicitações que dependem de ação humana, registre e informe prazo

FLUXO DE IDENTIFICAÇÃO:
- Ao iniciar, chame buscar_alunos_do_responsavel imediatamente
- Se encontrar o responsável, cumprimente pelo nome e apresente os filhos
- Se não encontrar, ofereça atendimento genérico (turmas, experimentais, nova matrícula)

CONFIRMAÇÃO OBRIGATÓRIA (antes de executar ações):
- Cancelamento: "Posso confirmar a solicitação de cancelamento da matrícula de [ALUNO] na turma [TURMA]? Responda *SIM* para confirmar."
- Mudança de turma: "Posso registrar sua solicitação de mudança de turma para [ALUNO]? Responda *SIM* para confirmar."
- Após receber SIM, execute a ação correspondente

ESCALAMENTO PARA HUMANO:
- Use escalar_para_humano quando: pergunta complexa fora do escopo, reclamação grave, após 3 tentativas sem resolução, ou quando o responsável solicitar explicitamente
- Motivo de escalamento deve ser descritivo e útil para a equipe

CAPACIDADES (use as ferramentas disponíveis):
✅ Consultar matrículas, turmas e horários
✅ Verificar frequência/presenças
✅ Verificar situação financeira e pagamentos
✅ Informar sobre eventos
✅ Solicitar cancelamento de matrícula (com confirmação)
✅ Agendar aula experimental
✅ Reenviar PIX ou contrato
✅ Solicitar mudança de turma
✅ Atualizar e-mail ou telefone de contato
✅ Escalar para atendimento humano

NÃO FAÇA:
❌ Não cancele matrículas sem confirmação explícita
❌ Não forneça dados de outros alunos/responsáveis
❌ Não discuta assuntos não relacionados à escola
❌ Não prometa ações que dependem exclusivamente da equipe`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gerenciamento de Sessão
// ─────────────────────────────────────────────────────────────────────────────

async function carregarOuCriarSessao(
  supabase: SupabaseClient,
  telefone: string,
  identidadeNome: string
): Promise<ConversaWhatsapp> {
  const telNorm = normalizeTelefone(telefone);
  const expiracaoLimite = new Date(Date.now() - SESSAO_EXPIRACAO_HORAS * 60 * 60 * 1000).toISOString();

  // Busca sessão ativa recente para este telefone
  const { data: sessaoExistente } = await supabase
    .from('conversas_whatsapp')
    .select('*')
    .eq('telefone', telNorm)
    .eq('status', 'ativo')
    .gte('ultima_mensagem_at', expiracaoLimite)
    .order('ultima_mensagem_at', { ascending: false })
    .limit(1)
    .single();

  if (sessaoExistente) {
    return sessaoExistente as ConversaWhatsapp;
  }

  // Cria nova sessão
  const { data: novaSessao, error } = await supabase
    .from('conversas_whatsapp')
    .insert({
      telefone: telNorm,
      identidade_nome: identidadeNome,
      historico: [],
      status: 'ativo',
      total_mensagens: 0
    })
    .select('*')
    .single();

  if (error) throw new Error(`Erro ao criar sessão: ${error.message}`);
  return novaSessao as ConversaWhatsapp;
}

async function salvarHistorico(
  supabase: SupabaseClient,
  conversaId: string,
  historico: SofiaMessage[],
  extraUpdates: Record<string, any> = {}
): Promise<void> {
  const { error } = await supabase
    .from('conversas_whatsapp')
    .update({
      historico,
      ultima_mensagem_at: new Date().toISOString(),
      total_mensagens: historico.length,
      ...extraUpdates
    })
    .eq('id', conversaId);

  if (error) {
    console.error('[Sofia] Erro ao salvar histórico:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notificação de Escalamento
// ─────────────────────────────────────────────────────────────────────────────

async function notificarEscalamento(
  supabase: SupabaseClient,
  conversa: ConversaWhatsapp,
  motivo: string,
  config: SofiaConfig
): Promise<void> {
  // Atualiza status da conversa
  await supabase
    .from('conversas_whatsapp')
    .update({
      status: 'escalado',
      escalado_at: new Date().toISOString()
    })
    .eq('id', conversa.id);

  // Notifica o admin via WhatsApp (se configurado)
  if (config.adminWhatsapp) {
    const msgAdmin = `🚨 *Atendimento Escalado — ${config.nomeAgente}*\n\n` +
      `📱 Responsável: ${conversa.responsavel_nome || conversa.telefone}\n` +
      `📞 Telefone: ${conversa.telefone}\n` +
      `🏫 Unidade: ${conversa.identidade_nome}\n` +
      `📝 Motivo: ${motivo}\n\n` +
      `Acesse o painel para continuar o atendimento.`;

    await enviarMensagemUTalk(config.adminWhatsapp, msgAdmin, config);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Processamento Principal da Mensagem
// ─────────────────────────────────────────────────────────────────────────────

export async function processarMensagem(
  supabase: SupabaseClient,
  ai: GoogleGenAI,
  telefone: string,
  mensagemTexto: string,
  config: SofiaConfig
): Promise<{ resposta: string; escalado: boolean; conversaId: string }> {
  
  const telNorm = normalizeTelefone(telefone);
  
  // 1. Carregar ou criar sessão
  const conversa = await carregarOuCriarSessao(supabase, telNorm, config.identidadeNome);
  
  // 2. Se escalada, não processar com IA
  if (conversa.status === 'escalado') {
    return {
      resposta: '',  // Sem resposta automática
      escalado: true,
      conversaId: conversa.id
    };
  }

  // 3. Contexto para as ferramentas
  const toolCtx: SofiaToolContext = {
    supabase,
    telefone: telNorm,
    identidadeNome: config.identidadeNome,
    nomeAgente: config.nomeAgente
  };

  // 4. Adiciona mensagem do usuário ao histórico
  const historico: SofiaMessage[] = [
    ...conversa.historico,
    { role: 'user', parts: [{ text: mensagemTexto }] }
  ];

  // 5. Chama o Gemini com Function Calling
  let respostaFinal = '';
  let escalado = false;
  let loopCount = 0;

  try {
    const model = ai.models;
    
    // Loop de function calling
    while (loopCount < MAX_TENTATIVAS_TOOL_LOOP) {
      loopCount++;

      const response = await model.generateContent({
        model: 'gemini-2.5-flash',
        contents: historico.map(m => ({
          role: m.role,
          parts: m.parts
        })),
        config: {
          systemInstruction: gerarSystemPrompt(config.nomeAgente),
          temperature: 0.4,
          tools: [{
            functionDeclarations: SOFIA_TOOL_DECLARATIONS
          }]
        }
      });

      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) {
        respostaFinal = `Desculpe, ocorreu um erro interno. Tente novamente em instantes.`;
        break;
      }

      const parts = candidate.content.parts;
      const textParts = parts.filter((p: any) => p.text);
      const toolCallParts = parts.filter((p: any) => p.functionCall);

      // Se não há chamadas de função, é a resposta final
      if (toolCallParts.length === 0) {
        respostaFinal = textParts.map((p: any) => p.text).join('\n').trim();
        
        // Adiciona resposta ao histórico
        historico.push({
          role: 'model',
          parts: [{ text: respostaFinal }]
        });
        break;
      }

      // Adiciona a resposta do modelo (com tool calls) ao histórico
      historico.push({
        role: 'model',
        parts: parts
      });

      // Executa as ferramentas chamadas
      const toolResults: any[] = [];
      for (const toolCallPart of toolCallParts) {
        const { name, args } = toolCallPart.functionCall;
        
        // Verifica escalamento
        if (name === 'escalar_para_humano') {
          await notificarEscalamento(supabase, conversa, args.motivo || 'Não especificado', config);
          escalado = true;
        }

        const resultado = await executarFerramenta(name, args || {}, toolCtx, conversa.id);
        
        toolResults.push({
          functionResponse: {
            name,
            response: { result: resultado }
          }
        });
      }

      // Adiciona resultados das ferramentas ao histórico
      historico.push({
        role: 'user',
        parts: toolResults
      });

      // Se escalado, para o loop
      if (escalado) {
        respostaFinal = `Entendido! Estou encaminhando seu atendimento para um de nossos especialistas. 👥\n\n` +
          `Em breve, alguém da nossa equipe entrará em contato pelo WhatsApp. ` +
          (isHorarioComercial()
            ? 'Aguarde, estamos no horário de atendimento! 🕐'
            : 'Como estamos fora do horário comercial (8h-18h), entraremos em contato no próximo dia útil. 📅');
        break;
      }
    }

    // Se excedeu o loop sem resposta
    if (!respostaFinal && loopCount >= MAX_TENTATIVAS_TOOL_LOOP) {
      respostaFinal = `Desculpe, estou com dificuldades para processar sua solicitação. Nossa equipe entrará em contato em breve! 🙏`;
    }

  } catch (e: any) {
    console.error('[Sofia] Erro ao processar com Gemini:', e);
    respostaFinal = `Desculpe, ocorreu um erro técnico. Tente novamente ou fale diretamente com nossa equipe. 🙏`;
  }

  // 6. Salva histórico atualizado
  await salvarHistorico(supabase, conversa.id, historico, {
    ...(escalado ? { status: 'escalado', escalado_at: new Date().toISOString() } : {})
  });

  return {
    resposta: respostaFinal,
    escalado,
    conversaId: conversa.id
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Busca configuração do agente para uma identidade
// ─────────────────────────────────────────────────────────────────────────────

export async function buscarConfigSofia(
  supabase: SupabaseClient,
  identidadeNome: string,
  utalkUrl: string
): Promise<SofiaConfig | null> {
  try {
    const { data: identidade, error } = await supabase
      .from('identidades')
      .select('nome, utalk_token, utalk_from_phone, utalk_organization_id, nome_agente_ia')
      .eq('nome', identidadeNome)
      .single();

    if (error || !identidade) return null;

    if (!identidade.utalk_token || !identidade.utalk_from_phone) return null;

    return {
      identidadeNome: identidade.nome,
      nomeAgente: identidade.nome_agente_ia || 'Sofia',
      utalkToken: identidade.utalk_token,
      utalkFromPhone: identidade.utalk_from_phone,
      utalkOrganizationId: identidade.utalk_organization_id || '',
      utalkUrl
    };
  } catch (e) {
    console.error('[Sofia] Erro ao buscar config:', e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Marcar conversa como resolvida (Admin action)
// ─────────────────────────────────────────────────────────────────────────────

export async function resolverConversa(
  supabase: SupabaseClient,
  conversaId: string
): Promise<void> {
  await supabase
    .from('conversas_whatsapp')
    .update({ status: 'ativo', escalado_at: null })
    .eq('id', conversaId);
}

export async function encerrarConversa(
  supabase: SupabaseClient,
  conversaId: string
): Promise<void> {
  await supabase
    .from('conversas_whatsapp')
    .update({ status: 'encerrado', encerrado_at: new Date().toISOString() })
    .eq('id', conversaId);
}
