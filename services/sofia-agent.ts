/**
 * sofia-agent.ts
 * 
 * Motor principal do Agente Sofia — Assistente Virtual via WhatsApp.
 * Gerencia sessões, processa mensagens com Gemini Function Calling,
 * persiste histórico e executa ferramentas.
 */

import { GoogleGenAI } from '@google/genai';
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
  parts: any[];  // Suporta text parts, function calls e function responses
  timestamp?: string; // Horário exato da mensagem
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
  iaAtiva?: boolean;
  utalkUrl: string;
  adminWhatsapp?: string;       // Número do admin para notificação de escalamento
  baseConhecimento?: string;
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

function gerarSystemPrompt(nomeAgente: string, alunosContext?: string, baseConhecimento?: string): string {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const horarioComercial = isHorarioComercial();

  let prompt = `Você é ${nomeAgente}, assistente virtual da Sport for Kids.
Seu papel é atender responsáveis de alunos com empatia, clareza e agilidade pelo WhatsApp.

DATA E HORA ATUAL: ${agora}
HORÁRIO COMERCIAL (8h-18h, seg-sáb): ${horarioComercial ? 'SIM (equipe disponível)' : 'NÃO (fora do horário comercial)'}

IDENTIDADE:
- Você é um assistente virtual — não finjas ser humana, mas seja calorosa e próxima
- Use linguagem descontraída mas profissional, como a de uma secretária simpática
- Responda SEMPRE em português brasileiro
`;

  if (baseConhecimento) {
    prompt += `\nBASE DE CONHECIMENTO (Informações e Regras da Unidade):\n${baseConhecimento}\n\n`;
  }

  if (alunosContext) {
    prompt += `\nINFORMAÇÃO OBTIDA AUTOMATICAMENTE DO BANCO DE DADOS PELO TELEFONE DO USUÁRIO:\n${alunosContext}\n\nSE ENCONTROU O RESPONSÁVEL, CUMPRIMENTE-O PELO NOME IMEDIATAMENTE (Você NÃO precisa pedir o nome dele, pois o sistema já identificou!).\n`;
  }

  prompt += `
REGRAS DE OURO:
1. NUNCA invente informações — use APENAS os dados retornados pelas ferramentas
2. Para ações que alteram dados (cancelamento, mudança de turma), SEMPRE confirme com o responsável antes de executar
3. Mantenha respostas CURTAS e diretas (WhatsApp não é e-mail — máximo 3-4 parágrafos por mensagem)
4. Use listas com "•" para informações estruturadas (horários, valores, etc.)
5. Emojis são bem-vindos com moderação: ✅ ❌ 📅 💰 🏃 👋
6. Se não souber ou a situação for complexa, escale para humano com motivo claro
7. Estimule sempre que o próprio responsável realize as ações de matrícula e agendamento de aula experimental por si mesmo usando os links diretos fornecidos ("faça você mesmo"). Deixe o atendimento humano apenas para problemas ou dúvidas muito específicas que ele não consiga resolver sozinho.

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
- Nova matrícula: "Posso formalizar a solicitação de matrícula de [ALUNO] na turma [TURMA]? Responda *SIM* para confirmar."
- Após receber SIM, execute a ação correspondente (ou chame a ferramenta 'escalar_para_humano' caso não exista ferramenta específica, como no caso de nova matrícula).

ESCALAMENTO PARA HUMANO:
- Use 'escalar_para_humano' quando: pergunta complexa fora do escopo, reclamação grave, após 3 tentativas sem resolução, quando o responsável solicitar explicitamente, ou para finalizar novas matrículas após a confirmação do usuário (já que não há ferramenta automática para matricular).
- REGRA CRÍTICA: Sempre que você decidir que a conversa deve ser transferida para um atendente humano (ou disser ao usuário que está escalando/chamando alguém), você DEVE obrigatoriamente chamar a ferramenta 'escalar_para_humano'. NUNCA envie apenas texto dizendo que escalou ou que vai escalar sem de fato chamar a ferramenta.
- Motivo de escalamento deve ser descritivo e útil para a equipe

CAPACIDADES (use as ferramentas disponíveis):
✅ Consultar matrículas, turmas e horários (você PODE e deve filtrar turmas por ano/série escolar usando o parâmetro ano_escolar de buscar_turmas_disponiveis). REGRA IMPORTANTE: Ao listar turmas disponíveis para o cliente, exiba apenas os detalhes essenciais (nome da turma, dias/horários e mensalidade) e forneça o link do portal da unidade correspondente para que ele veja as informações mais detalhadas e fotos.
✅ Verificar frequência/presenças
✅ Verificar situação financeira e pagamentos
✅ Informar sobre eventos
✅ Solicitar cancelamento de matrícula (com confirmação)
✅ Agendar aula experimental
✅ Reenviar PIX ou contrato
✅ Solicitar mudança de turma
✅ Atualizar e-mail ou telefone de contato
✅ Escalar para atendimento humano

ORIENTAÇÃO PARA FLUXOS E AÇÕES DO RESPONSÁVEL:
Sempre que o usuário solicitar instruções sobre como realizar alguma das ações abaixo, você deve fornecer o link correspondente e o passo a passo resumido (diferenciando Desktop e Mobile de forma sucinta com emojis):

1. 📝 MATRÍCULA E CADASTRO ONLINE:
   • Link: https://matriculas.sportforkids.com.br/portal?acao=matricula (ou o portal da unidade com a ação se já souber a unidade, ex: https://matriculas.sportforkids.com.br/portal/{unidade-slug}?acao=matricula)
   • Computador (Desktop): Acesse o link ➡️ Escolha a turma ➡️ Clique em "Matrícula" ➡️ Preencha dados do Responsável ➡️ Dados do Aluno ➡️ Escolha o plano e aceite o Contrato ➡️ Pague por Pix ou Cartão.
   • Celular (Mobile): Abra o link ➡️ Use o filtro no topo ➡️ Toque em "Matrícula" ➡️ Preencha o formulário em etapas simples ➡️ Pague com Pix Copia e Cola ou Cartão.

2. 🧪 AULA EXPERIMENTAL (Agendamento):
   • Link: https://matriculas.sportforkids.com.br/portal?acao=experimental (ou o portal da unidade com a ação se já souber a unidade, ex: https://matriculas.sportforkids.com.br/portal/{unidade-slug}?acao=experimental)
   • Computador (Desktop): Acesse o link ➡️ Escolha a turma ➡️ Clique em "Aula Experimental" ➡️ Insira os dados solicitados e envie.
   • Celular (Mobile): Abra o link ➡️ Use o filtro ➡️ Toque em "Aula Experimental" ➡️ Preencha os dados e finalize o agendamento.
   • Observação: Embora ele possa agendar sozinho pelo link, prefira primeiro oferecer para agendar para ele usando a ferramenta 'criar_solicitacao_experimental' para maior comodidade.

3. 🛍️ COMPRA DE PRODUTOS (Loja):
   • Link: https://matriculas.sportforkids.com.br/loja
   • Computador (Desktop): Acesse o link ➡️ Selecione o produto e tamanho ➡️ Adicione ao Carrinho ➡️ Clique no carrinho (topo direito) ➡️ Preencha dados e finalize.
   • Celular (Mobile): Abra o link ➡️ Escolha o item e tamanho ➡️ Adicione ao Carrinho ➡️ Toque na sacola flutuante na parte inferior ➡️ Preencha os dados e pague por Pix Copia e Cola.

4. 🏆 INSCRIÇÃO EM EVENTOS:
   • Link: https://matriculas.sportforkids.com.br/eventos
   • Passo a passo: Selecione o evento desejado ➡️ Clique em "Inscrever-se" ➡️ Digite o CPF do responsável e dados do participante ➡️ Faça o pagamento da taxa de inscrição.

5. 🔑 PORTAL DO RESPONSÁVEL (Acesso a faturas, faturamento, contratos, presenças):
   • Link: https://matriculas.sportforkids.com.br/area-do-cliente
   • Passo a passo: Acesse o link ➡️ Informe seu CPF ➡️ Receba o código de acesso por WhatsApp ou E-mail (login seguro sem senha) ➡️ Acesse o painel com as presenças, recibos, agenda e faturas.

NÃO FAÇA:
❌ Não cancele matrículas sem confirmação explícita
❌ Não forneça dados de outros alunos/responsáveis
❌ Não discuta assuntos não relacionados à escola
❌ Não prometa ações que dependem exclusivamente da equipe`;

  return prompt;
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
    .in('status', ['ativo', 'escalado'])
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
  
  const isPrimeiraMensagem = conversa.historico.length === 0;

  // 1.5 Prevenção de duplicatas (Retries do Webhook ou ecos da IA)
  if (!isPrimeiraMensagem) {
    const ultimaMsg = conversa.historico[conversa.historico.length - 1];
    const ultimaMsgText = ultimaMsg.parts?.map((p: any) => p.text || '').join('').trim();
    const tempoDesdeUltima = Date.now() - new Date(conversa.ultima_mensagem_at || Date.now()).getTime();
    // Busca a última mensagem do usuário no histórico
    const ultimaUserMsg = [...conversa.historico].reverse().find(m => m.role === 'user');
    const ultimaUserMsgText = ultimaUserMsg?.parts?.map((p: any) => p.text || '').join('').trim();
    
    // Evita loop por retry de webhook: se for mesma mensagem de usuário em < 5 minutos
    if (ultimaUserMsg && ultimaUserMsgText === mensagemTexto.trim() && tempoDesdeUltima < 300000) {
      console.log(`[Sofia] Mensagem duplicada ignorada (retry/spam): ${telNorm}`);
      return { resposta: '', escalado: conversa.status === 'escalado', conversaId: conversa.id };
    }
    
    // Evita loop por eco de forma definitiva: verifica a assinatura fixa da Sofia
    if (mensagemTexto.includes('Sofia, Assistente Virtual') || (ultimaMsg.role === 'model' && ultimaMsgText && mensagemTexto.includes(ultimaMsgText))) {
      console.log(`[Sofia] Eco de mensagem da IA ignorado: ${telNorm}`);
      return { resposta: '', escalado: conversa.status === 'escalado', conversaId: conversa.id };
    }
  }

  // 2. Se a IA estiver desativada, apenas salva a mensagem no painel e ignora
  if (config.iaAtiva === false) {
    const historico: SofiaMessage[] = [
      ...conversa.historico,
      { role: 'user', parts: [{ text: mensagemTexto }], timestamp: new Date().toISOString() }
    ];
    await salvarHistorico(supabase, conversa.id, historico);
    return {
      resposta: '',
      escalado: conversa.status === 'escalado',
      conversaId: conversa.id
    };
  }
  
  // 3. Adiciona mensagem do usuário ao histórico E SALVA IMEDIATAMENTE (p/ evitar webhook retries)
  const historico: SofiaMessage[] = [
    ...conversa.historico,
    { role: 'user', parts: [{ text: mensagemTexto }], timestamp: new Date().toISOString() }
  ];
  await salvarHistorico(supabase, conversa.id, historico);

  // 4. Se escalada, não processar com IA (mas já salvou a msg)
  if (conversa.status === 'escalado') {
    return {
      resposta: '',  // Sem resposta automática
      escalado: true,
      conversaId: conversa.id
    };
  }

  // 5. Contexto para as ferramentas
  const toolCtx: SofiaToolContext = {
    supabase,
    telefone: telNorm,
    identidadeNome: config.identidadeNome,
    nomeAgente: config.nomeAgente,
    conversaId: conversa.id
  };

  // 6. Se é a PRIMEIRA mensagem da conversa, busca alunos antecipadamente para injetar no prompt
  let alunosContextStr: string | undefined;
  if (isPrimeiraMensagem) {
    // Para evitar importar a função e ter dependência circular, podemos chamar o executarFerramenta diretamente
    try {
      const res = await executarFerramenta('buscar_alunos_do_responsavel', {}, toolCtx, conversa.id);
      alunosContextStr = typeof res === 'string' ? res : JSON.stringify(res);
    } catch (e) {
      console.error('[Sofia] Erro ao buscar alunos no início da conversa:', e);
    }
  }

  // 6. Chama o Gemini com Function Calling
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
          systemInstruction: gerarSystemPrompt(config.nomeAgente, alunosContextStr, config.baseConhecimento),
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
          parts: [{ text: respostaFinal }],
          timestamp: new Date().toISOString()
        });
        break;
      }

      // Adiciona a resposta do modelo (com tool calls) ao histórico
      historico.push({
        role: 'model' as const,
        parts: parts as any[],
        timestamp: new Date().toISOString()
      });

      // Executa as ferramentas chamadas
      const toolResults: any[] = [];
      for (const toolCallPart of toolCallParts) {
        const { name, args } = toolCallPart.functionCall as { name: string; args: Record<string, any> };
        
        // Verifica escalamento
        if (name === 'escalar_para_humano') {
          await notificarEscalamento(supabase, conversa, String(args?.motivo || 'Não especificado'), config);
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
        parts: toolResults,
        timestamp: new Date().toISOString()
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
      .select('nome, utalk_token, utalk_from_phone, utalk_organization_id, nome_agente_ia, ia_ativa, base_conhecimento')
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
      iaAtiva: identidade.ia_ativa !== false, // default true
      baseConhecimento: identidade.base_conhecimento || undefined,
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
