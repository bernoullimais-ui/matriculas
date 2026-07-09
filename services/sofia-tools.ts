/**
 * sofia-tools.ts
 * 
 * Ferramentas (Tools) disponíveis para o Agente Sofia via Gemini Function Calling.
 * Cada função consulta o Supabase e retorna dados estruturados para a IA.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Type } from '@google/genai';

// ─────────────────────────────────────────────────────────────────────────────
// Tipo de contexto passado para todas as ferramentas
// ─────────────────────────────────────────────────────────────────────────────

export interface SofiaToolContext {
  supabase: SupabaseClient;
  telefone: string;             // Telefone do responsável (normalizado, só dígitos)
  identidadeNome: string;       // Nome da unidade/identidade que recebeu a mensagem
  nomeAgente: string;           // Nome do agente IA (ex: "Sofia")
  conversaId?: string;          // ID da sessão (opcional, para atualizações da sessão na base)
}

// ─────────────────────────────────────────────────────────────────────────────
// Schemas das ferramentas para o Gemini (Function Declarations)
// ─────────────────────────────────────────────────────────────────────────────

export const SOFIA_TOOL_DECLARATIONS = [
  {
    name: 'buscar_alunos_do_responsavel',
    description: 'Busca os alunos vinculados ao número de WhatsApp do responsável que está conversando. Deve ser chamada no início de toda conversa de responsável identificado.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  },
  {
    name: 'buscar_matriculas',
    description: 'Retorna as matrículas (ativas e canceladas) de um aluno específico, incluindo nome da turma, horários, status, plano e datas.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        aluno_id: {
          type: Type.STRING,
          description: 'ID do aluno (obtido via buscar_alunos_do_responsavel)'
        }
      },
      required: ['aluno_id']
    }
  },
  {
    name: 'buscar_presencas',
    description: 'Retorna a frequência/presenças recentes de um aluno nas últimas 4 semanas.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        aluno_id: {
          type: Type.STRING,
          description: 'ID do aluno'
        }
      },
      required: ['aluno_id']
    }
  },
  {
    name: 'buscar_pagamentos',
    description: 'Retorna o histórico completo de pagamentos de um aluno: status (pago, pendente, vencido), valores, datas de vencimento e pagamento, e método.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        aluno_id: {
          type: Type.STRING,
          description: 'ID do aluno'
        }
      },
      required: ['aluno_id']
    }
  },
  {
    name: 'buscar_turmas_disponiveis',
    description: 'Lista turmas abertas e disponíveis para matrícula, com horários, professor, local e vagas. Útil para responsáveis com interesse em matrícula ou mudança de turma.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        unidade: {
          type: Type.STRING,
          description: 'Nome da unidade para filtrar (opcional)'
        },
        modalidade: {
          type: Type.STRING,
          description: 'Modalidade esportiva para filtrar (ex: natação, judô, ballet) - opcional'
        },
        ano_escolar: {
          type: Type.STRING,
          description: 'Ano escolar ou série do aluno para filtrar turmas permitidas (ex: 2º ano do Ensino Fundamental, Grupo 4 Educação Infantil) - opcional'
        }
      },
      required: []
    }
  },
  {
    name: 'buscar_eventos',
    description: 'Retorna eventos ativos ou futuros da escola, com datas, descrição e informações de inscrição.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  },
  {
    name: 'criar_tarefa_cancelamento',
    description: 'Cria uma solicitação formal de cancelamento de matrícula. Esta ação cria uma tarefa pendente para aprovação da equipe. Use apenas após confirmação explícita do responsável (resposta "SIM").',
    parameters: {
      type: Type.OBJECT,
      properties: {
        aluno_id: {
          type: Type.STRING,
          description: 'ID do aluno'
        },
        matricula_id: {
          type: Type.STRING,
          description: 'ID da matrícula a cancelar'
        },
        motivo: {
          type: Type.STRING,
          description: 'Motivo do cancelamento informado pelo responsável'
        }
      },
      required: ['aluno_id', 'matricula_id']
    }
  },
  {
    name: 'criar_solicitacao_experimental',
    description: 'Registra o interesse de agendamento de uma aula experimental para um novo aluno ou visitante. Cria um registro para que a equipe entre em contato.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        nome_aluno: {
          type: Type.STRING,
          description: 'Nome do aluno que irá fazer a aula experimental'
        },
        responsavel_nome: {
          type: Type.STRING,
          description: 'Nome do responsável'
        },
        modalidade_interesse: {
          type: Type.STRING,
          description: 'Modalidade esportiva de interesse (opcional)'
        },
        observacao: {
          type: Type.STRING,
          description: 'Observações adicionais (ex: idade do aluno, disponibilidade)'
        }
      },
      required: ['nome_aluno']
    }
  },
  {
    name: 'reenviar_pix',
    description: 'Reenvia o link ou código PIX de uma mensalidade em aberto para o responsável.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        aluno_id: {
          type: Type.STRING,
          description: 'ID do aluno'
        },
        pagamento_id: {
          type: Type.STRING,
          description: 'ID do pagamento específico (opcional — se omitido, usa o mais recente em aberto)'
        }
      },
      required: ['aluno_id']
    }
  },
  {
    name: 'reenviar_contrato',
    description: 'Reenvia o contrato de matrícula por e-mail para o responsável.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        aluno_id: {
          type: Type.STRING,
          description: 'ID do aluno'
        },
        matricula_id: {
          type: Type.STRING,
          description: 'ID da matrícula (opcional — usa a ativa mais recente se omitido)'
        }
      },
      required: ['aluno_id']
    }
  },
  {
    name: 'criar_tarefa_mudanca_turma',
    description: 'Registra uma solicitação de mudança de turma ou horário para análise da equipe. Não executa a mudança diretamente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        aluno_id: {
          type: Type.STRING,
          description: 'ID do aluno'
        },
        matricula_id: {
          type: Type.STRING,
          description: 'ID da matrícula atual'
        },
        motivo: {
          type: Type.STRING,
          description: 'Motivo da solicitação de mudança'
        },
        preferencia_horario: {
          type: Type.STRING,
          description: 'Horário ou turma preferida (se informado pelo responsável)'
        }
      },
      required: ['aluno_id']
    }
  },
  {
    name: 'atualizar_cadastro',
    description: 'Atualiza o e-mail ou telefone de contato do responsável no cadastro do aluno.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        aluno_id: {
          type: Type.STRING,
          description: 'ID do aluno'
        },
        campo: {
          type: Type.STRING,
          description: 'Campo a atualizar: "email" ou "telefone"'
        },
        novo_valor: {
          type: Type.STRING,
          description: 'Novo valor para o campo'
        }
      },
      required: ['aluno_id', 'campo', 'novo_valor']
    }
  },
  {
    name: 'escalar_para_humano',
    description: 'Encaminha o atendimento para um membro humano da equipe. Use quando: (1) a pergunta está fora das capacidades da IA, (2) o responsável solicitar explicitamente, (3) a situação envolve reclamação grave ou conflito, (4) após 3 tentativas sem resolver o problema.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        motivo: {
          type: Type.STRING,
          description: 'Motivo do escalamento para o registro interno'
        }
      },
      required: ['motivo']
    }
  },
  {
    name: 'consultar_tabela_banco',
    description: 'Consulta informações em tempo real de uma das tabelas de banco de dados disponíveis na base de conhecimento (ex: loja_produtos). Use sempre que precisar responder sobre estoque, preços, produtos ou outras tabelas fornecidas.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tabela: {
          type: Type.STRING,
          description: 'Nome da tabela a ser consultada (deve ser exatamente como aparece na lista de tabelas disponíveis, ex: loja_produtos)'
        },
        filtro_coluna: {
          type: Type.STRING,
          description: 'Nome da coluna para aplicar filtro de busca opcional (ex: nome, descricao)'
        },
        filtro_valor: {
          type: Type.STRING,
          description: 'Valor para buscar na coluna (texto parcial ou exato)'
        }
      },
      required: ['tabela']
    }
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// Implementação das Ferramentas
// ─────────────────────────────────────────────────────────────────────────────

/** Normaliza um número de telefone para apenas dígitos */
function normalizeTelefone(tel: string): string {
  return tel.replace(/\D/g, '');
}

/** Formata data ISO para exibição em PT-BR */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'não informado';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

/** Formata valor monetário em BRL */
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
}

// ─── Tool: buscar_alunos_do_responsavel ─────────────────────────────────────

export async function buscarAlunosDoResponsavel(ctx: SofiaToolContext): Promise<string> {
  try {
    const telNorm = normalizeTelefone(ctx.telefone);
    const telSem55 = telNorm.startsWith('55') ? telNorm.substring(2) : telNorm;
    
    // Variante sem o 9º dígito (caso no banco esteja salvo sem o 9)
    const telSem9 = (telSem55.length === 11 && telSem55[2] === '9') 
      ? telSem55.substring(0, 2) + telSem55.substring(3) 
      : telSem55;

    // Cria strings com * entre cada dígito para achar números formatados como (71) 99141-4913 no PostgREST
    const createWildcard = (t: string) => '*' + t.split('').join('*') + '*';
    
    const telVariants = [
      createWildcard(telSem55),
      createWildcard('55' + telSem55),
      ...(telSem55 !== telSem9 ? [
        createWildcard(telSem9),
        createWildcard('55' + telSem9)
      ] : [])
    ];

    // Busca por whatsapp_1 ou whatsapp_2 em qualquer variante do número
    const { data: alunos, error } = await ctx.supabase
      .from('alunos')
      .select('id, nome_completo, unidade, unidade_origem_id, status_matricula, responsavel_1, whatsapp_1, responsavel_2, whatsapp_2, email, data_nascimento, serie_ano')
      .or(
        telVariants.map(t => `whatsapp_1.ilike.${t},whatsapp_2.ilike.${t}`).join(',')
      )
      .limit(10);

    if (error) throw error;

    if (!alunos || alunos.length === 0) {
      return JSON.stringify({
        encontrado: false,
        mensagem: 'Nenhum aluno encontrado para este número de telefone. O responsável pode ser um visitante ou o número não está cadastrado.'
      });
    }

    // Resolvendo nomes das unidades caso a coluna unidade esteja nula/vazia
    const unitIds = [...new Set(alunos.map(a => a.unidade_origem_id).filter(Boolean))];
    const unitMap: Record<string, string> = {};
    if (unitIds.length > 0) {
      const { data: units } = await ctx.supabase
        .from('unidades')
        .select('id, nome')
        .in('id', unitIds);
      if (units) {
        units.forEach((u: any) => {
          unitMap[u.id] = u.nome;
        });
      }
    }

    const matchesPhone = (dbPhone: string | null | undefined) => {
      if (!dbPhone) return false;
      const cleanDb = dbPhone.replace(/\D/g, '');
      const cleanDbSem55 = cleanDb.startsWith('55') ? cleanDb.substring(2) : cleanDb;
      const cleanDbSem9 = (cleanDbSem55.length === 11 && cleanDbSem55[2] === '9')
        ? cleanDbSem55.substring(0, 2) + cleanDbSem55.substring(3)
        : cleanDbSem55;
      return cleanDbSem55 === telSem55 || cleanDbSem9 === telSem9;
    };

    const isResp1 = alunos.some(a => matchesPhone(a.whatsapp_1));
    const isResp2 = alunos.some(a => matchesPhone(a.whatsapp_2));

    const responsavelNome = (isResp2 && !isResp1)
      ? (alunos[0].responsavel_2 || alunos[0].responsavel_1 || 'Responsável')
      : (alunos[0].responsavel_1 || alunos[0].responsavel_2 || 'Responsável');

    const nomesAlunos = alunos.map(a => a.nome_completo.split(' ')[0]).join(', ');
    const unidades = [...new Set(alunos.map(a => a.unidade || (a.unidade_origem_id ? unitMap[a.unidade_origem_id] : null)).filter(Boolean))].join(', ');
    
    const tituloResponsavel = `${responsavelNome} (${nomesAlunos} - ${unidades})`;

    // Atualiza o nome do responsável na sessão da conversa, incluindo dependentes e unidade
    if (ctx.conversaId) {
      await ctx.supabase
        .from('conversas_whatsapp')
        .update({
          responsavel_nome: tituloResponsavel,
          aluno_ids: alunos.map(a => a.id)
        })
        .eq('id', ctx.conversaId);
    }

    return JSON.stringify({
      encontrado: true,
      total: alunos.length,
      responsavel_nome_detectado: responsavelNome,
      alunos: alunos.map(a => {
        let idade = null;
        if (a.data_nascimento) {
          const birthDate = new Date(a.data_nascimento);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          idade = age;
        }
        return {
          id: a.id,
          nome: a.nome_completo,
          unidade: a.unidade || (a.unidade_origem_id ? unitMap[a.unidade_origem_id] : null),
          status_matricula: a.status_matricula,
          responsavel1: a.responsavel_1,
          responsavel2: a.responsavel_2,
          email: a.email,
          data_nascimento: a.data_nascimento,
          idade: idade,
          serie_ano: a.serie_ano
        };
      })
    });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao buscar alunos' });
  }
}

// ─── Tool: buscar_matriculas ─────────────────────────────────────────────────

export async function buscarMatriculas(ctx: SofiaToolContext, alunoId: string): Promise<string> {
  try {
    const { data: matriculas, error } = await ctx.supabase
      .from('matriculas')
      .select('id, turma_id, turma, unidade, status, plano, data_matricula, data_cancelamento, created_at')
      .eq('aluno_id', alunoId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!matriculas || matriculas.length === 0) {
      return JSON.stringify({ encontrado: false, mensagem: 'Nenhuma matrícula encontrada para este aluno.' });
    }

    // Busca detalhes das turmas
    const turmaIds = [...new Set(matriculas.map(m => m.turma_id).filter(Boolean))];
    let turmasMap: Record<string, any> = {};

    if (turmaIds.length > 0) {
      const { data: turmas } = await ctx.supabase
        .from('turmas')
        .select('id, nome, dias_horarios, professor, local_aula, capacidade, valor_mensalidade')
        .in('id', turmaIds);

      if (turmas) {
        turmas.forEach(t => { turmasMap[t.id] = t; });
      }
    }

    return JSON.stringify({
      encontrado: true,
      total: matriculas.length,
      matriculas: matriculas.map(m => {
        const turma = turmasMap[m.turma_id] || {};
        return {
          id: m.id,
          status: m.status,
          plano: m.plano,
          unidade: m.unidade,
          data_matricula: formatDate(m.data_matricula),
          data_cancelamento: m.data_cancelamento ? formatDate(m.data_cancelamento) : null,
          turma: {
            id: m.turma_id,
            nome: turma.nome || m.turma || 'Turma não identificada',
            horarios: turma.dias_horarios,
            professor: turma.professor,
            local: turma.local_aula,
            valor_mensalidade: turma.valor_mensalidade ? formatCurrency(turma.valor_mensalidade * 100) : null
          }
        };
      })
    });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao buscar matrículas' });
  }
}

// ─── Tool: buscar_presencas ──────────────────────────────────────────────────

export async function buscarPresencas(ctx: SofiaToolContext, alunoId: string): Promise<string> {
  try {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 28); // últimas 4 semanas

    const { data: presencas, error } = await ctx.supabase
      .from('presencas')
      .select('id, turma_id, unidade, data, status, observacao')
      .eq('aluno_id', alunoId)
      .gte('data', dataLimite.toISOString().split('T')[0])
      .order('data', { ascending: false });

    if (error) throw error;

    const total = presencas?.length || 0;
    const presentes = presencas?.filter(p => p.status === 'Presente').length || 0;
    const ausentes = presencas?.filter(p => p.status === 'Ausente').length || 0;
    const taxaPresenca = total > 0 ? Math.round((presentes / total) * 100) : null;

    return JSON.stringify({
      periodo: 'Últimas 4 semanas',
      total_aulas: total,
      presentes,
      ausentes,
      taxa_presenca_pct: taxaPresenca,
      registros: (presencas || []).map(p => ({
        data: formatDate(p.data),
        status: p.status,
        observacao: p.observacao || null
      }))
    });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao buscar presenças' });
  }
}

// ─── Tool: buscar_pagamentos ─────────────────────────────────────────────────

export async function buscarPagamentos(ctx: SofiaToolContext, alunoId: string): Promise<string> {
  try {
    // Busca pagamentos na tabela de pagamentos (Wix/Pagar.me)
    const { data: pagamentos, error } = await ctx.supabase
      .from('pagamentos_pagarme')
      .select('id, valor, status, data_vencimento, data_pagamento, metodo_pagamento, plano, created_at, pix_qr_code, pix_qr_code_url, boleto_url')
      .eq('aluno_id', alunoId)
      .order('created_at', { ascending: false })
      .limit(12);

    if (error && error.code !== 'PGRST116') {
      // Tenta tabela alternativa
      const { data: pagAlt } = await ctx.supabase
        .from('pagamentos')
        .select('id, valor, status, data, metodo, plano')
        .eq('aluno_id', alunoId)
        .order('data', { ascending: false })
        .limit(12);

      return JSON.stringify({
        encontrado: (pagAlt?.length || 0) > 0,
        total: pagAlt?.length || 0,
        pagamentos: (pagAlt || []).map(p => ({
          id: p.id,
          valor: typeof p.valor === 'number' ? formatCurrency(p.valor * 100) : String(p.valor),
          status: p.status,
          data: formatDate(p.data),
          metodo: p.metodo,
          plano: p.plano
        }))
      });
    }

    const pendentes = (pagamentos || []).filter(p =>
      ['pending', 'waiting_payment', 'pendente'].includes(p.status?.toLowerCase() || '')
    );

    return JSON.stringify({
      encontrado: (pagamentos?.length || 0) > 0,
      total: pagamentos?.length || 0,
      pendentes_count: pendentes.length,
      pagamentos: (pagamentos || []).map(p => ({
        id: p.id,
        valor: formatCurrency(p.valor),
        status: p.status,
        data_vencimento: formatDate(p.data_vencimento),
        data_pagamento: formatDate(p.data_pagamento),
        metodo: p.metodo_pagamento,
        plano: p.plano,
        tem_pix: !!(p.pix_qr_code || p.pix_qr_code_url),
        tem_boleto: !!p.boleto_url,
        pix_copia_cola: pendentes.some(pend => pend.id === p.id) ? p.pix_qr_code : undefined
      }))
    });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao buscar pagamentos' });
  }
}

// ─── Tool: buscar_turmas_disponiveis ─────────────────────────────────────────

export async function buscarTurmasDisponiveis(
  ctx: SofiaToolContext,
  unidade?: string,
  modalidade?: string,
  ano_escolar?: string
): Promise<string> {
  try {
    let query = ctx.supabase
      .from('turmas')
      .select('id, nome, unidade_nome, dias_horarios, professor, local_aula, capacidade, valor_mensalidade, idade_minima, idade_maxima, ativa, series_permitidas')
      .eq('ativa', true)
      .order('nome');

    // Aumentamos o limite para 1000 para poder fazer filtragem na memória sem truncar resultados
    const { data: turmas, error } = await query.limit(1000);
    if (error) throw error;

    if (!turmas || turmas.length === 0) {
      return JSON.stringify({ encontrado: false, mensagem: 'Nenhuma turma disponível encontrada com os filtros informados.' });
    }

    let filteredTurmas = turmas;

    // Função auxiliar para normalizar strings (remover acentos e minúsculas)
    const normalizeString = (str: string) => {
      return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    };

    if (unidade) {
      const unidadeNorm = normalizeString(unidade.split(' ')[0]);
      filteredTurmas = filteredTurmas.filter(t => t.unidade_nome && normalizeString(t.unidade_nome).includes(unidadeNorm));
    }

    if (modalidade) {
      const modalidadeNorm = normalizeString(modalidade);
      filteredTurmas = filteredTurmas.filter(t => t.nome && normalizeString(t.nome).includes(modalidadeNorm));
    }

    if (ano_escolar) {
      const searchNorm = ano_escolar.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/ ensino /g, " ")
        .replace(/do /g, "")
        .replace(/da /g, "")
        .replace(/º/g, "o")
        .replace(/ª/g, "a")
        .trim();

      filteredTurmas = turmas.filter(t => {
        // Se a turma não tiver restrições de séries permitidas, ela é aberta para todos
        if (!t.series_permitidas || !Array.isArray(t.series_permitidas) || t.series_permitidas.length === 0) {
          return true;
        }

        return t.series_permitidas.some((s: string) => {
          const sNorm = s.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/ ensino /g, " ")
            .replace(/do /g, "")
            .replace(/da /g, "")
            .replace(/º/g, "o")
            .replace(/ª/g, "a")
            .trim();

          return sNorm.includes(searchNorm) || searchNorm.includes(sNorm);
        });
      });
    }

    if (filteredTurmas.length === 0) {
      return JSON.stringify({ 
        encontrado: false, 
        mensagem: `Nenhuma turma encontrada que permita o ano escolar: ${ano_escolar}.` 
      });
    }

    return JSON.stringify({
      encontrado: true,
      total: filteredTurmas.length,
      turmas: filteredTurmas.map(t => ({
        id: t.id,
        nome: t.nome,
        unidade: t.unidade_nome,
        horarios: t.dias_horarios,
        professor: t.professor,
        local: t.local_aula,
        valor_mensalidade: t.valor_mensalidade ? `R$ ${t.valor_mensalidade.toFixed(2).replace('.', ',')}` : null,
        faixa_etaria: t.idade_minima || t.idade_maxima
          ? `${t.idade_minima || '?'} a ${t.idade_maxima || '?'} anos`
          : null,
        series_permitidas: t.series_permitidas
      }))
    });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao buscar turmas' });
  }
}

// ─── Tool: buscar_eventos ────────────────────────────────────────────────────

export async function buscarEventos(ctx: SofiaToolContext): Promise<string> {
  try {
    const hoje = new Date().toISOString().split('T')[0];

    const { data: eventos, error } = await ctx.supabase
      .from('eventos')
      .select('id, titulo, descricao, data_inicio, data_fim, local, taxa_inscricao, slug, tipo_preco, opcoes_precos')
      .gte('data_inicio', hoje)
      .order('data_inicio')
      .limit(10);

    if (error && error.code === 'PGRST116') {
      return JSON.stringify({ encontrado: false, mensagem: 'Não há eventos futuros agendados no momento.' });
    }
    if (error) throw error;

    if (!eventos || eventos.length === 0) {
      return JSON.stringify({ encontrado: false, mensagem: 'Não há eventos futuros agendados no momento.' });
    }

    return JSON.stringify({
      encontrado: true,
      total: eventos.length,
      eventos: eventos.map(e => {
        let valorFomatado = 'Gratuito';
        if (e.tipo_preco === 'categorias' && Array.isArray(e.opcoes_precos) && e.opcoes_precos.length > 0) {
          const precos = e.opcoes_precos.map((op: any) => op.preco).filter((p: any) => p !== undefined && p !== null);
          if (precos.length > 0) {
            const min = Math.min(...precos);
            const max = Math.max(...precos);
            if (min === max) {
              valorFomatado = formatCurrency(min * 100);
            } else {
              valorFomatado = `A partir de ${formatCurrency(min * 100)}`;
            }
          } else {
            valorFomatado = 'Valores variam por categoria (verifique no link)';
          }
        } else if (e.taxa_inscricao && Number(e.taxa_inscricao) > 0) {
          valorFomatado = formatCurrency(Number(e.taxa_inscricao) * 100);
        } else if (e.tipo_preco === 'fixo' && e.taxa_inscricao === 0) {
          valorFomatado = 'Gratuito';
        }

        return {
          id: e.id,
          titulo: e.titulo,
          descricao: e.descricao,
          data_inicio: formatDate(e.data_inicio),
          data_fim: e.data_fim ? formatDate(e.data_fim) : null,
          local: e.local,
          valor_inscricao: valorFomatado
        };
      })
    });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao buscar eventos' });
  }
}

// ─── Tool: criar_tarefa_cancelamento ─────────────────────────────────────────

export async function criarTarefaCancelamento(
  ctx: SofiaToolContext,
  alunoId: string,
  matriculaId: string,
  motivo?: string
): Promise<string> {
  try {
    const { data: tarefa, error } = await ctx.supabase
      .from('tarefas')
      .insert({
        tipo: 'cancelamento',
        status: 'pendente',
        aluno_id: alunoId,
        matricula_id: matriculaId,
        responsavel_id: ctx.telefone,
        detalhes: {
          motivo: motivo || 'Não informado',
          origem: 'sofia_whatsapp',
          telefone_responsavel: ctx.telefone,
          solicitado_em: new Date().toISOString()
        }
      })
      .select('id')
      .single();

    if (error) throw error;

    return JSON.stringify({
      sucesso: true,
      tarefa_id: tarefa?.id,
      mensagem: 'Solicitação de cancelamento registrada com sucesso. Nossa equipe irá analisar e entrar em contato em breve.'
    });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao criar tarefa de cancelamento' });
  }
}

// ─── Tool: criar_solicitacao_experimental ────────────────────────────────────

export async function criarSolicitacaoExperimental(
  ctx: SofiaToolContext,
  nomeAluno: string,
  responsavelNome?: string,
  modalidadeInteresse?: string,
  observacao?: string
): Promise<string> {
  try {
    const { error } = await ctx.supabase
      .from('aulas_experimentais')
      .insert({
        id: `sofia-exp-${Date.now()}`,
        estudante: nomeAluno,
        unidade: ctx.identidadeNome,
        whatsapp1: ctx.telefone,
        responsavel1: responsavelNome || 'Não informado',
        curso: modalidadeInteresse || 'A definir',
        status: 'Pendente',
        ocorrencia: observacao || null,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return JSON.stringify({
      sucesso: true,
      mensagem: 'Solicitação de aula experimental registrada! Nossa equipe entrará em contato pelo WhatsApp para confirmar data e horário.'
    });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao registrar solicitação experimental' });
  }
}

// ─── Tool: reenviar_pix ───────────────────────────────────────────────────────

export async function reenviarPix(
  ctx: SofiaToolContext,
  alunoId: string,
  pagamentoId?: string
): Promise<string> {
  try {
    let query = ctx.supabase
      .from('pagamentos_pagarme')
      .select('id, valor, pix_qr_code, pix_qr_code_url, status, data_vencimento')
      .eq('aluno_id', alunoId)
      .in('status', ['pending', 'waiting_payment', 'pendente'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (pagamentoId) {
      query = query.eq('id', pagamentoId);
    }

    const { data: pagamentos, error } = await query;

    if (error || !pagamentos || pagamentos.length === 0) {
      return JSON.stringify({
        sucesso: false,
        mensagem: 'Não foi encontrado nenhum pagamento PIX pendente para este aluno.'
      });
    }

    const pag = pagamentos[0];

    if (!pag.pix_qr_code && !pag.pix_qr_code_url) {
      return JSON.stringify({
        sucesso: false,
        mensagem: 'Este pagamento não possui PIX disponível. Entre em contato com a secretaria.'
      });
    }

    return JSON.stringify({
      sucesso: true,
      valor: formatCurrency(pag.valor),
      data_vencimento: formatDate(pag.data_vencimento),
      pix_copia_cola: pag.pix_qr_code || null,
      pix_url: pag.pix_qr_code_url || null,
      mensagem: 'Código PIX encontrado. Envie o código abaixo para o responsável.'
    });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao buscar PIX' });
  }
}

// ─── Tool: reenviar_contrato ──────────────────────────────────────────────────

export async function reenviarContrato(
  ctx: SofiaToolContext,
  alunoId: string,
  matriculaId?: string
): Promise<string> {
  try {
    // Busca dados do aluno
    const { data: aluno } = await ctx.supabase
      .from('alunos')
      .select('nome_completo, email, responsavel_1')
      .eq('id', alunoId)
      .single();

    if (!aluno?.email) {
      return JSON.stringify({
        sucesso: false,
        mensagem: 'Este aluno não possui e-mail cadastrado. Não é possível reenviar o contrato por e-mail.'
      });
    }

    // Cria tarefa para o admin reenviar o contrato
    await ctx.supabase.from('tarefas').insert({
      tipo: 'reenvio_contrato',
      status: 'pendente',
      aluno_id: alunoId,
      matricula_id: matriculaId || null,
      detalhes: {
        origem: 'sofia_whatsapp',
        email_destino: aluno.email,
        responsavel: aluno.responsavel_1,
        telefone_responsavel: ctx.telefone,
        solicitado_em: new Date().toISOString()
      }
    });

    return JSON.stringify({
      sucesso: true,
      email: aluno.email,
      mensagem: `Solicitação de reenvio do contrato registrada. Será enviado para ${aluno.email} em breve.`
    });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao solicitar reenvio do contrato' });
  }
}

// ─── Tool: criar_tarefa_mudanca_turma ─────────────────────────────────────────

export async function criarTarefaMudancaTurma(
  ctx: SofiaToolContext,
  alunoId: string,
  matriculaId?: string,
  motivo?: string,
  preferenciaHorario?: string
): Promise<string> {
  try {
    const { data: tarefa, error } = await ctx.supabase
      .from('tarefas')
      .insert({
        tipo: 'mudanca_turma',
        status: 'pendente',
        aluno_id: alunoId,
        matricula_id: matriculaId || null,
        detalhes: {
          motivo: motivo || 'Não informado',
          preferencia_horario: preferenciaHorario || 'Não informado',
          origem: 'sofia_whatsapp',
          telefone_responsavel: ctx.telefone,
          solicitado_em: new Date().toISOString()
        }
      })
      .select('id')
      .single();

    if (error) throw error;

    return JSON.stringify({
      sucesso: true,
      tarefa_id: tarefa?.id,
      mensagem: 'Solicitação de mudança de turma registrada. Nossa equipe analisará a disponibilidade e entrará em contato.'
    });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao criar tarefa de mudança de turma' });
  }
}

// ─── Tool: atualizar_cadastro ─────────────────────────────────────────────────

export async function atualizarCadastro(
  ctx: SofiaToolContext,
  alunoId: string,
  campo: string,
  novoValor: string
): Promise<string> {
  try {
    const camposPermitidos: Record<string, string> = {
      email: 'email',
      telefone: 'whatsapp1',
      celular: 'whatsapp1',
      whatsapp: 'whatsapp1'
    };

    const campoDb = camposPermitidos[campo.toLowerCase()];
    if (!campoDb) {
      return JSON.stringify({
        sucesso: false,
        mensagem: `Campo "${campo}" não pode ser atualizado por este canal. Campos disponíveis: email, telefone/WhatsApp.`
      });
    }

    const { error } = await ctx.supabase
      .from('alunos')
      .update({ [campoDb]: novoValor })
      .eq('id', alunoId);

    if (error) throw error;

    return JSON.stringify({
      sucesso: true,
      mensagem: `${campo} atualizado com sucesso para: ${novoValor}`
    });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao atualizar cadastro' });
  }
}

// ─── Tool: escalar_para_humano ────────────────────────────────────────────────

export async function escalarParaHumano(
  ctx: SofiaToolContext,
  conversaId: string,
  motivo: string
): Promise<string> {
  try {
    const { error } = await ctx.supabase
      .from('conversas_whatsapp')
      .update({
        status: 'escalado',
        escalado_at: new Date().toISOString()
      })
      .eq('id', conversaId);

    // Note: the actual status update is handled by the agent
    return JSON.stringify({
      sucesso: true,
      motivo,
      mensagem: 'Atendimento escalado para equipe humana. Responsável será informado.'
    });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao escalar atendimento' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool: consultar_tabela_banco
// ─────────────────────────────────────────────────────────────────────────────

export async function consultarTabelaBanco(
  ctx: SofiaToolContext,
  tabela: string,
  filtroColuna?: string,
  filtroValor?: string
): Promise<string> {
  try {
    const { data: identidade } = await ctx.supabase
      .from('identidades')
      .select('base_conhecimento')
      .eq('nome', ctx.identidadeNome)
      .single();

    if (!identidade || !identidade.base_conhecimento) {
      return JSON.stringify({ erro: 'Base de conhecimento não configurada para esta identidade.' });
    }

    const bc = typeof identidade.base_conhecimento === 'string' 
      ? JSON.parse(identidade.base_conhecimento) 
      : identidade.base_conhecimento;

    const tabelas = bc.tabelas_banco || [];
    const configTabela = tabelas.find((t: any) => t.nome === tabela);

    if (!configTabela) {
      return JSON.stringify({ erro: `Tabela '${tabela}' não está autorizada para consulta.` });
    }

    const colunasSelect = configTabela.colunas || '*';
    let query: any = ctx.supabase.from(tabela).select(colunasSelect);

    if (configTabela.filtro) {
      const partes = configTabela.filtro.split('=');
      if (partes.length === 2) {
        const col = partes[0].trim();
        let val: any = partes[1].trim();
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        query = query.eq(col, val);
      }
    }

    if (filtroColuna && filtroValor) {
      query = query.ilike(filtroColuna, `%${filtroValor}%`);
    }

    const { data, error } = await query.limit(20);

    if (error) throw error;

    if (!data || data.length === 0) {
      return JSON.stringify({ mensagem: `Nenhum registro encontrado na tabela ${tabela} com esses filtros.` });
    }

    return JSON.stringify({ sucesso: true, tabela, resultados: data });
  } catch (e: any) {
    return JSON.stringify({ erro: e.message || 'Erro ao consultar tabela.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Executor de Ferramentas
// ─────────────────────────────────────────────────────────────────────────────

/** Executa uma ferramenta pelo nome com os argumentos fornecidos pelo Gemini */
export async function executarFerramenta(
  toolName: string,
  args: Record<string, any>,
  ctx: SofiaToolContext,
  conversaId: string
): Promise<string> {
  console.log(`[Sofia] Executando ferramenta: ${toolName}`, args);

  switch (toolName) {
    case 'buscar_alunos_do_responsavel':
      return buscarAlunosDoResponsavel(ctx);

    case 'buscar_matriculas':
      return buscarMatriculas(ctx, args.aluno_id);

    case 'buscar_presencas':
      return buscarPresencas(ctx, args.aluno_id);

    case 'buscar_pagamentos':
      return buscarPagamentos(ctx, args.aluno_id);

    case 'buscar_turmas_disponiveis':
      return buscarTurmasDisponiveis(ctx, args.unidade, args.modalidade, args.ano_escolar);

    case 'buscar_eventos':
      return buscarEventos(ctx);

    case 'criar_tarefa_cancelamento':
      return criarTarefaCancelamento(ctx, args.aluno_id, args.matricula_id, args.motivo);

    case 'criar_solicitacao_experimental':
      return criarSolicitacaoExperimental(ctx, args.nome_aluno, args.responsavel_nome, args.modalidade_interesse, args.observacao);

    case 'reenviar_pix':
      return reenviarPix(ctx, args.aluno_id, args.pagamento_id);

    case 'reenviar_contrato':
      return reenviarContrato(ctx, args.aluno_id, args.matricula_id);

    case 'criar_tarefa_mudanca_turma':
      return criarTarefaMudancaTurma(ctx, args.aluno_id, args.matricula_id, args.motivo, args.preferencia_horario);

    case 'atualizar_cadastro':
      return atualizarCadastro(ctx, args.aluno_id, args.campo, args.novo_valor);

    case 'escalar_para_humano':
      return escalarParaHumano(ctx, conversaId, args.motivo);

    case 'consultar_tabela_banco':
      return consultarTabelaBanco(ctx, args.tabela, args.filtro_coluna, args.filtro_valor);

    default:
      return JSON.stringify({ erro: `Ferramenta "${toolName}" não encontrada.` });
  }
}
