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
// Helper: Obtém horário comercial dinâmico da base de conhecimento
// ─────────────────────────────────────────────────────────────────────────────

function obterHorarioComercial(baseConhecimento?: string): { active: boolean, textoExibicao: string } {
  let inicio = 8;
  let fim = 18;
  let dias = [1, 2, 3, 4, 5, 6]; // seg-sáb (1..6)
  let textoExibicao = '8h às 18h, de segunda a sábado';

  if (baseConhecimento) {
    try {
      const parsed = JSON.parse(baseConhecimento);
      let horarioStr = '';
      if (parsed.fluxo_de_transbordo_horario) {
        horarioStr = parsed.fluxo_de_transbordo_horario;
      } else if (parsed.fluxo_de_transbordo) {
        horarioStr = parsed.fluxo_de_transbordo;
      }

      if (horarioStr) {
        const strLower = horarioStr.toLowerCase();
        let labelDia = 'segunda a sábado';
        if (strLower.includes('segunda a sexta') || strLower.includes('seg a sex') || strLower.includes('segunda à sexta')) {
          dias = [1, 2, 3, 4, 5]; // seg-sex
          labelDia = 'segunda a sexta-feira';
        } else if (strLower.includes('segunda a sábado') || strLower.includes('seg a sab') || strLower.includes('segunda à sábado')) {
          dias = [1, 2, 3, 4, 5, 6]; // seg-sáb
          labelDia = 'segunda a sábado';
        }

        const hourMatches = [...horarioStr.matchAll(/(\d{1,2})(?:h|:00|:30|\s)/g)];
        if (hourMatches.length >= 2) {
          const h1 = parseInt(hourMatches[0][1], 10);
          const h2 = parseInt(hourMatches[1][1], 10);
          if (h1 >= 0 && h1 <= 24 && h2 >= 0 && h2 <= 24 && h1 < h2) {
            inicio = h1;
            fim = h2;
          }
        }
        
        textoExibicao = `${inicio}h às ${fim}h, de ${labelDia}`;
      }
    } catch (e) {
      // ignore
    }
  }

  // Obter hora local em São Paulo (UTC-3)
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hora = agora.getHours();
  const diaSemana = agora.getDay(); // 0=Dom, 1=Seg, ..., 6=Sáb

  const active = dias.includes(diaSemana) && hora >= inicio && hora < fim;

  return { active, textoExibicao };
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

function gerarSystemPrompt(
  nomeAgente: string, 
  alunosContext?: string, 
  baseConhecimento?: string,
  unidadesContext?: string
): string {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const { active: horarioComercial, textoExibicao } = obterHorarioComercial(baseConhecimento);

  let prompt = `Você é ${nomeAgente}, assistente virtual da Sport for Kids.
Seu papel é atender responsáveis de alunos com empatia, clareza e agilidade pelo WhatsApp.

DATA E HORA ATUAL: ${agora}
HORÁRIO DE ATENDIMENTO DA EQUIPE HUMANA (${textoExibicao}): ${horarioComercial ? 'SIM (equipe disponível)' : 'NÃO (fora do horário de atendimento)'}

IDENTIDADE:
- Você é um assistente virtual — não finjas ser humana, mas seja calorosa e próxima
- Use linguagem descontraída mas profissional, como a de uma secretária simpática
- Responda SEMPRE em português brasileiro
- Se o responsável enviar um arquivo, mídia ou anexo, você verá a indicação no formato "[Mídia Recebida: Nome (URL)]" no histórico. Confirme educadamente o recebimento do anexo (ex: "Recebi seu arquivo com sucesso!") e explique com empatia que você não consegue visualizar o conteúdo de imagens/arquivos diretamente, mas que a equipe humana analisará o anexo assim que possível.
`;

  if (baseConhecimento) {
    const trimmed = baseConhecimento.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        prompt += `\nBASE DE CONHECIMENTO (Informações e Regras da Unidade):\n`;
        
        // 1. Comportamento
        let comportamentoStr = '';
        if (parsed.comportamento_nome) comportamentoStr += `Nome do Assistente: ${parsed.comportamento_nome}\n`;
        if (parsed.comportamento_tom) comportamentoStr += `Tom de Voz: ${parsed.comportamento_tom}\n`;
        if (parsed.comportamento_persona) comportamentoStr += `Persona: ${parsed.comportamento_persona}\n`;
        if (parsed.comportamento_regras) comportamentoStr += `Diretrizes de Formatação: ${parsed.comportamento_regras}\n`;
        if (!comportamentoStr.trim() && parsed.comportamento) comportamentoStr = parsed.comportamento;
        if (comportamentoStr.trim()) prompt += `\n[COMPORTAMENTO, PERSONA E TOM DE VOZ]\n${comportamentoStr.trim()}\n`;
        
        // 2. Regras de Negócio
        if (parsed.regras_de_negocio) prompt += `\n[REGRAS DE NEGÓCIO E LIMITES OPERACIONAIS]\n${parsed.regras_de_negocio}\n`;
        
        // 3. Tabelas de Banco
        if (Array.isArray(parsed.tabelas_banco) && parsed.tabelas_banco.length > 0) {
          prompt += `\n[TABELAS DE BANCO DE DADOS DISPONÍVEIS PARA CONSULTA]\n`;
          parsed.tabelas_banco.forEach((t: any) => {
            prompt += `- Tabela: ${t.nome || ''}\n  Colunas: ${t.colunas || ''}\n  Filtro padrão: ${t.filtro || 'nenhum'}\n  Uso recomendado: ${t.descricao || ''}\n\n`;
          });
        }
        
        // 4. Websites
        if (Array.isArray(parsed.websites) && parsed.websites.length > 0) {
          prompt += `\n[WEBSITES E LINKS PARA INDICAÇÃO]\n`;
          parsed.websites.forEach((w: any) => {
            prompt += `- Link: ${w.url || ''} (${w.descricao || ''})\n`;
          });
          prompt += `\n`;
        }
        
        // 5. Documentos
        if (Array.isArray(parsed.documentos) && parsed.documentos.length > 0) {
          prompt += `\n[DOCUMENTOS E MANUAIS INSTITUCIONAIS]\n`;
          parsed.documentos.forEach((d: any) => {
            prompt += `--- DOCUMENTO: ${d.nome || 'Sem Nome'} ---\n${d.conteudo || ''}\n\n`;
          });
        }
        
        // 6. FAQ
        if (Array.isArray(parsed.perguntas_respostas) && parsed.perguntas_respostas.length > 0) {
          prompt += `\n[PERGUNTAS E RESPOSTAS FREQUENTES (FAQ)]\n`;
          parsed.perguntas_respostas.forEach((faq: any) => {
            prompt += `P: ${faq.pergunta || ''}\nR: ${faq.resposta || ''}\n\n`;
          });
        }
        
        // 7. Script de Vendas
        if (parsed.script_de_vendas_e_objecoes) prompt += `\n[SCRIPT DE VENDAS E CONTORNO DE OBJEÇÕES]\n${parsed.script_de_vendas_e_objecoes}\n`;
        
        // 8. Transbordo
        let transbordoStr = '';
        if (parsed.fluxo_de_transbordo_condicoes) transbordoStr += `Quando transferir: ${parsed.fluxo_de_transbordo_condicoes}\n`;
        if (parsed.fluxo_de_transbordo_mensagem) transbordoStr += `Mensagem de despedida humana: ${parsed.fluxo_de_transbordo_mensagem}\n`;
        if (parsed.fluxo_de_transbordo_horario) transbordoStr += `Horários da equipe humana: ${parsed.fluxo_de_transbordo_horario}\n`;
        if (!transbordoStr.trim() && parsed.fluxo_de_transbordo) transbordoStr = parsed.fluxo_de_transbordo;
        if (transbordoStr.trim()) prompt += `\n[REGRAS E FLUXO DE TRANSBORDO PARA HUMANO]\n${transbordoStr.trim()}\n`;

        prompt += `\n`;
      } catch (e) {
        prompt += `\nBASE DE CONHECIMENTO (Informações e Regras da Unidade):\n${baseConhecimento}\n\n`;
      }
    } else {
      prompt += `\nBASE DE CONHECIMENTO (Informações e Regras da Unidade):\n${baseConhecimento}\n\n`;
    }
  }

  if (unidadesContext) {
    prompt += `\nUNIDADES DE ATENDIMENTO E REGRAS DE ACESSO (Quem atende público externo vs apenas alunos da própria escola):\n${unidadesContext}\n\n`;
  }

  let hasVinc = false;
  if (alunosContext) {
    prompt += `\nINFORMAÇÃO OBTIDA AUTOMATICAMENTE DO BANCO DE DADOS PELO TELEFONE DO USUÁRIO:\n${alunosContext}\n`;
    try {
      const parsed = JSON.parse(alunosContext);
      if (parsed.encontrado && parsed.alunos && parsed.alunos.length > 0) {
        hasVinc = true;
        const first = parsed.alunos[0];
        const responsavelNome = parsed.responsavel_nome_detectado || first.responsavel1 || first.responsavel2 || 'Responsável';
        const nomesAlunos = parsed.alunos.map((a: any) => a.nome.split(' ')[0]).join(', ');
        prompt += `
[VÍNCULO CADASTRAL ENCONTRADO]
O telefone pertence ao responsável: **${responsavelNome}**
Filhos/dependentes cadastrados: **${nomesAlunos}**

REGRA CRÍTICA DE SAUDAÇÃO E IDENTIFICAÇÃO:
- O responsável e os filhos já foram identificados pelo número de WhatsApp acima.
- Você DEVE iniciar cumprimentando o responsável pelo nome: "${responsavelNome}" e apresentar/citar os seus filhos.
- NUNCA pergunte quem está falando ou se ele é responsável por algum aluno, pois isso já está identificado.
- Vá direto ao ponto de forma calorosa!
`;
      }
    } catch (e) {}
  }

  if (!hasVinc) {
    prompt += `
[VÍNCULO CADASTRAL NÃO ENCONTRADO]
- Nenhum aluno foi encontrado no banco de dados para este número de WhatsApp.
- Trate o contato com cortesia como um novo visitante (Lead).
- Apresente-se (como ${nomeAgente}) e pergunte de forma simpática o nome dele e se ele é responsável por algum aluno ou se deseja conhecer as turmas.
`;
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
- Se o responsável foi identificado no bloco [VÍNCULO CADASTRAL ENCONTRADO], cumprimente-o pelo nome e apresente os filhos.
- Se não foi identificado, pergunte o nome de forma simpática e ofereça atendimento genérico (turmas, experimentais, nova matrícula).

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
Sempre que o usuário solicitar instruções sobre como realizar alguma das ações abaixo, você deve fornecer o link correspondente e o passo a passo unificado de forma simples (utilizando emojis):

1. 📝 MATRÍCULA E CADASTRO ONLINE:
   • Link: https://www.sportforkids.com.br/portal?acao=matricula (ou o portal da unidade se já souber a unidade, ex: https://www.sportforkids.com.br/portal/{unidade-slug}?acao=matricula)
   • Passo a passo: Acesse o link ➡️ Escolha seu dependente já cadastrado ou cadastre um novo ➡️ Clique em "Próximo passo >" ➡️ Selecione a "Unidade de Atendimento", a "Turma Desejada" e Confirme o Aceite dos Termos ➡️ Clique em "Próximo Passo >" ➡️ Preencha os dados de pagamento do Responsável ➡️ Clique em "Finalizar matrícula"

2. 🧪 AULA EXPERIMENTAL (Agendamento):
   • Link: https://www.sportforkids.com.br/portal?acao=experimental (ou o portal da unidade se já souber a unidade, ex: https://www.sportforkids.com.br/portal/{unidade-slug}?acao=experimental)
   • Passo a passo: Acesse o link ➡️ Escolha seu dependente já cadastrado ou cadastre um novo ➡️ Selecione a "Unidade de Atendimento" e a "Turma Desejada" ➡️ Indique a Data da aula Experimental ➡️ Clique em "Agendar Aula Experimental"
   • Observação: Sempre envie o link direto acima para o agendamento online imediato pelo próprio responsável.

3. 🛍️ COMPRA DE PRODUTOS (Loja):
   • Link: https://www.sportforkids.com.br/loja
   • Passo a passo: Acesse o link ➡️ Selecione o produto e o tamanho ➡️ Adicione ao Carrinho ➡️ Clique no carrinho (topo direito) ➡️ Preencha seus dados e finalize a compra com o pagamento via cartão de crédito ou PIX

4. 🏆 INSCRIÇÃO EM EVENTOS:
   • Link: https://www.sportforkids.com.br/eventos
   • Passo a passo: Acesse o link ➡️ Selecione a Categoria para a inscrição ➡️ Clique em Inscrição Online ➡️ Preencha os dados solicitados e envie para finalizar com o pagamento via PIX ou cartão ➡️ Clique em “Finalizar Inscrição”

5. 🔑 PORTAL DO RESPONSÁVEL (Acesso a faturas, faturamento, contratos, presenças):
   • Link: https://www.sportforkids.com.br/area-do-cliente
   • Passo a passo: Acesse o link ➡️ Informe seu CPF ➡️ Receba o código de acesso por WhatsApp ou E-mail (login seguro sem senha) ➡️ Acesse o painel com as presenças, recibos, agenda e faturas.

NÃO FAÇA:
❌ Não cancele matrículas sem confirmação explícita
❌ Não forneça dados de outros alunos/responsáveis
❌ Não discuta assuntos não relacionados à escola
❌ Não prometa ações que dependem exclusivamente da equipe
❌ Não afirme que todas as unidades atendem apenas alunos das próprias escolas. Consulte sempre a seção "UNIDADES DE ATENDIMENTO E REGRAS DE ACESSO" para responder se uma unidade atende ao público externo ou apenas alunos da própria escola.`;

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

  // Cria nova sessão, herdando etiquetas da última sessão existente se houver
  let etiquetasHerdadas: string[] = [];
  try {
    const { data: ultimaSessao } = await supabase
      .from('conversas_whatsapp')
      .select('etiquetas')
      .eq('telefone', telNorm)
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (ultimaSessao && ultimaSessao.length > 0 && Array.isArray(ultimaSessao[0].etiquetas)) {
      etiquetasHerdadas = ultimaSessao[0].etiquetas;
    }
  } catch (err) {
    console.error('[Sofia] Erro ao buscar última sessão para herdar etiquetas:', err);
  }

  // Cria nova sessão
  const { data: novaSessao, error } = await supabase
    .from('conversas_whatsapp')
    .insert({
      telefone: telNorm,
      identidade_nome: identidadeNome,
      historico: [],
      status: 'ativo',
      total_mensagens: 0,
      etiquetas: etiquetasHerdadas
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
  config: SofiaConfig,
  mediaUrl?: string,
  mediaName?: string
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
    const ultimaUserMediaPart = ultimaUserMsg?.parts?.find((p: any) => p.mediaUrl);
    const ultimaUserMediaUrl = ultimaUserMediaPart ? (ultimaUserMediaPart as any).mediaUrl : '';
    
    // Evita loop por retry de webhook: se for mesma mensagem de usuário e mesmo anexo em < 5 minutos
    if (
      ultimaUserMsg && 
      ultimaUserMsgText === mensagemTexto.trim() && 
      ultimaUserMediaUrl === (mediaUrl || '') &&
      tempoDesdeUltima < 300000
    ) {
      console.log(`[Sofia] Mensagem duplicada ignorada (retry/spam): ${telNorm}`);
      return { resposta: '', escalado: conversa.status === 'escalado', conversaId: conversa.id };
    }
    
    // Evita loop por eco de forma definitiva: verifica a assinatura fixa da Sofia
    if (mensagemTexto.includes('Sofia, Assistente Virtual') || (ultimaMsg.role === 'model' && ultimaMsgText && mensagemTexto.includes(ultimaMsgText))) {
      console.log(`[Sofia] Eco de mensagem da IA ignorado: ${telNorm}`);
      return { resposta: '', escalado: conversa.status === 'escalado', conversaId: conversa.id };
    }
  }

  // Prepara as partes da mensagem do usuário
  const userParts: any[] = [];
  if (mensagemTexto.trim()) {
    userParts.push({ text: mensagemTexto });
  }
  if (mediaUrl) {
    userParts.push({
      mediaUrl: mediaUrl,
      mediaName: mediaName || 'Arquivo Anexo'
    });
    userParts.push({
      text: `[Mídia Recebida: ${mediaName || 'Arquivo Anexo'} (${mediaUrl})]`
    });
  }

  // 2. Se a IA estiver desativada, apenas salva a mensagem no painel e ignora
  if (config.iaAtiva === false) {
    const historico: SofiaMessage[] = [
      ...conversa.historico,
      { role: 'user', parts: userParts, timestamp: new Date().toISOString() }
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
    { role: 'user', parts: userParts, timestamp: new Date().toISOString() }
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

  // 4.5. Silenciamento temporário caso a conversa tenha sido iniciada por um atendente humano
  const primeiroItemNaoSistema = conversa.historico.find(m => (m as any).role !== 'system');
  const isOperatorInitiated = conversa.historico.some(
    m => (m as any).role === 'system' && (m as any).content?.includes('painel')
  ) || (
    primeiroItemNaoSistema?.role === 'model' && 
    primeiroItemNaoSistema.parts?.[0]?.text?.includes('[Atendente -')
  );

  if (isOperatorInitiated) {
    const operatorMessages = conversa.historico.filter(
      m => m.role === 'model' && m.parts?.[0]?.text?.includes('[Atendente -')
    );
    
    const lastOperatorMsg = operatorMessages[operatorMessages.length - 1];
    const lastOperatorTime = lastOperatorMsg
      ? new Date(lastOperatorMsg.timestamp || Date.now()).getTime()
      : new Date(conversa.created_at || Date.now()).getTime();
      
    const timeSinceLastOperator = Date.now() - lastOperatorTime;
    const oneHour = 60 * 60 * 1000;
    
    if (timeSinceLastOperator < oneHour) {
      console.log(`[Sofia] Conversa iniciada por atendente. Último retorno/criação há ${Math.round(timeSinceLastOperator / 60000)} minutos. Silenciando IA.`);
      return {
        resposta: '', // Silencia a IA
        escalado: false,
        conversaId: conversa.id
      };
    }
  }

  // 5. Contexto para as ferramentas
  const toolCtx: SofiaToolContext = {
    supabase,
    telefone: telNorm,
    identidadeNome: config.identidadeNome,
    nomeAgente: config.nomeAgente,
    conversaId: conversa.id
  };

  // 6. Busca alunos antecipadamente para injetar no prompt
  let alunosContextStr: string | undefined;
  try {
    const res = await executarFerramenta('buscar_alunos_do_responsavel', {}, toolCtx, conversa.id);
    alunosContextStr = typeof res === 'string' ? res : JSON.stringify(res);
  } catch (e) {
    console.error('[Sofia] Erro ao buscar alunos para o prompt:', e);
  }

  // 6.5. Busca informações de acesso das unidades (público externo vs restrito)
  let unidadesContextStr: string | undefined;
  try {
    const { data: dbUnidades } = await supabase
      .from('unidades')
      .select('nome, access_type')
      .eq('ativo', true);
      
    if (dbUnidades && dbUnidades.length > 0) {
      unidadesContextStr = dbUnidades
        .map(u => `- ${u.nome}: ${u.access_type || 'Restrito a alunos'}`)
        .join('\n');
    }
  } catch (e) {
    console.error('[Sofia] Erro ao buscar unidades para o prompt:', e);
  }

  function sanitizarParts(parts: any[]): any[] {
    if (!Array.isArray(parts)) return [];
    return parts
      .map(p => {
        if (p.text) {
          return { text: String(p.text) };
        }
        if (p.inlineData) {
          return { inlineData: p.inlineData };
        }
        if (p.fileData) {
          return { fileData: p.fileData };
        }
        if (p.functionCall) {
          return { functionCall: p.functionCall };
        }
        if (p.functionResponse) {
          return { functionResponse: p.functionResponse };
        }
        return null;
      })
      .filter(Boolean);
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
          parts: sanitizarParts(m.parts)
        })),
        config: {
          systemInstruction: gerarSystemPrompt(config.nomeAgente, alunosContextStr, config.baseConhecimento, unidadesContextStr),
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
        // Se o modelo gerou texto junto com a chamada de função, prioriza esse texto
        const geminiText = textParts.map((p: any) => p.text).join('\n').trim();
        if (geminiText) {
          respostaFinal = geminiText;
        } else {
          const { active: isComercial, textoExibicao } = obterHorarioComercial(config.baseConhecimento);
          respostaFinal = `Entendido! Estou encaminhando seu atendimento para um de nossos especialistas. 👥\n\n` +
            `Em breve, alguém da nossa equipe entrará em contato pelo WhatsApp. ` +
            (isComercial
              ? 'Aguarde, estamos no horário de atendimento! 🕐'
              : `Como estamos fora do nosso horário de atendimento (${textoExibicao}), entraremos em contato no próximo dia útil. 📅`);
        }
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

  // Fail-safe: se a resposta final contiver indicativos claros de transferência ou escalamento,
  // e ainda não estiver marcada como escalada, forçamos o status para escalado.
  if (!escalado && respostaFinal) {
    const lowerResponse = respostaFinal.toLowerCase();
    const indicatesEscalation = 
      (lowerResponse.includes('equipe humana') && (lowerResponse.includes('fila') || lowerResponse.includes('prioridade') || lowerResponse.includes('registrado'))) ||
      lowerResponse.includes('transferir seu atendimento') ||
      lowerResponse.includes('encaminhando seu atendimento') ||
      lowerResponse.includes('consultor entrará em contato') ||
      lowerResponse.includes('especialista entrará em contato') ||
      lowerResponse.includes('atendente entrará em contato') ||
      (lowerResponse.includes('equipe') && lowerResponse.includes('entrará em contato') && lowerResponse.includes('aguarda'));
      
    if (indicatesEscalation) {
      console.log(`[Sofia Fail-safe] Forçando escalamento detectado pelo texto da resposta para telefone ${telefone}`);
      await notificarEscalamento(supabase, conversa, 'Detecção automática via texto da resposta: ' + respostaFinal.substring(0, 100), config);
      escalado = true;
    }
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
