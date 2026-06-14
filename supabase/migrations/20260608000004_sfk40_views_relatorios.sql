-- ============================================================
-- MIGRATION SFK 4.0 — PASSO 4: Views e Funções para Relatórios
-- Cria as views de uso comum para frequência (pedagógica) e
-- relatórios financeiros (segregados por unidade).
-- ============================================================

-- ─────────────────────────────────────────────
-- VIEW 1: Lista de chamada unificada por sessão
-- Para a tela do professor: todos os alunos de uma turma,
-- independente da unidade de origem.
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_chamada_sessao AS
SELECT
  s.id                      AS sessao_id,
  s.data_aula,
  s.hora_inicio,
  s.hora_fim,
  s.status                  AS status_sessao,
  t.id                      AS turma_id,
  t.nome                    AS turma_nome,
  t.tipo_turma,
  a.id                      AS aluno_id,
  a.nome_completo           AS aluno_nome,
  a.data_nascimento,
  u_origem.id               AS unidade_origem_id,
  u_origem.nome             AS unidade_origem,
  u_origem.slug             AS unidade_origem_slug,
  m.id                      AS matricula_id,
  m.status                  AS status_matricula,
  -- Frequência (null = ainda não registrado)
  p.presente,
  p.observacoes             AS observacao_presenca
FROM public.sessoes s
INNER JOIN public.turmas t         ON t.id = s.turma_id
INNER JOIN public.matriculas m     ON m.turma_id = t.id
                                   AND m.status IN ('ativo', 'Ativo', 'ativa')
INNER JOIN public.alunos a         ON a.id = m.aluno_id
LEFT  JOIN public.unidades u_origem ON u_origem.id = a.unidade_origem_id
LEFT  JOIN public.presencas p      ON p.sessao_id = s.id
                                   AND p.aluno_id = a.id;

-- ─────────────────────────────────────────────
-- VIEW 2: Relatório financeiro segregado por unidade
-- Para o módulo financeiro: receita separada por unidade.
-- Pivô: matriculas.unidade_id (nunca alunos.unidade_origem_id)
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_financeiro_por_unidade AS
SELECT
  u.id                      AS unidade_id,
  u.nome                    AS unidade,
  u.slug                    AS unidade_slug,
  t.id                      AS turma_id,
  t.nome                    AS turma_nome,
  t.tipo_turma,
  a.id                      AS aluno_id,
  a.nome_completo           AS aluno_nome,
  m.id                      AS matricula_id,
  m.status                  AS status_matricula,
  m.plano,
  m.data_matricula,
  p.id                      AS pagamento_id,
  p.valor,
  p.status                  AS status_pagamento,
  p.data_vencimento,
  p.data_pagamento,
  p.metodo_pagamento,
  p.pagarme                 AS gateway_id,
  -- Mês de referência (extraído da data de vencimento)
  DATE_TRUNC('month', p.data_vencimento) AS mes_competencia
FROM public.matriculas m
INNER JOIN public.unidades u    ON u.id = m.unidade_id
INNER JOIN public.alunos a      ON a.id = m.aluno_id
INNER JOIN public.turmas t      ON t.id = m.turma_id
INNER JOIN public.pagamentos p  ON p.matricula_id = m.id;

-- ─────────────────────────────────────────────
-- VIEW 3: KPIs financeiros por unidade e mês
-- Para o dashboard: totais de receita, inadimplência e
-- a_receber por unidade e mês.
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_kpi_financeiro_mensal AS
SELECT
  unidade_id,
  unidade,
  mes_competencia,
  COUNT(DISTINCT matricula_id)                                         AS total_matriculas,
  COUNT(DISTINCT aluno_id)                                             AS total_alunos,
  COUNT(pagamento_id)                                                  AS total_cobrancas,
  SUM(valor)                                                           AS receita_prevista,
  SUM(CASE WHEN status_pagamento = 'pago'     THEN valor ELSE 0 END)   AS receita_realizada,
  SUM(CASE WHEN status_pagamento = 'atrasado' THEN valor ELSE 0 END)   AS inadimplencia,
  SUM(CASE WHEN status_pagamento = 'pendente' THEN valor ELSE 0 END)   AS a_receber,
  SUM(CASE WHEN status_pagamento = 'falha'    THEN valor ELSE 0 END)   AS falhas
FROM public.vw_financeiro_por_unidade
GROUP BY unidade_id, unidade, mes_competencia;

-- ─────────────────────────────────────────────
-- VIEW 4: Turmas compartilhadas — visão por unidade
-- Para gestão operacional: quantidade de alunos de cada unidade
-- dentro de cada turma compartilhada.
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_turmas_compartilhadas AS
SELECT
  t.id                          AS turma_id,
  t.nome                        AS turma_nome,
  t.tipo_turma,
  u.id                          AS unidade_id,
  u.nome                        AS unidade,
  COUNT(DISTINCT m.aluno_id)    AS total_alunos_unidade
FROM public.turmas t
INNER JOIN public.matriculas m  ON m.turma_id = t.id
                                AND m.status IN ('ativo', 'Ativo', 'ativa')
INNER JOIN public.unidades u    ON u.id = m.unidade_id
WHERE t.tipo_turma = 'compartilhada'
GROUP BY t.id, t.nome, t.tipo_turma, u.id, u.nome
ORDER BY t.nome, u.nome;

-- ─────────────────────────────────────────────
-- FUNÇÃO: Criar sessão e registrar chamada de uma vez
-- Simplifica o trabalho do professor ao abrir a tela de frequência
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_obter_ou_criar_sessao(
  p_turma_id UUID,
  p_data_aula DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_sessao_id UUID;
BEGIN
  -- Busca sessão existente
  SELECT id INTO v_sessao_id
  FROM public.sessoes
  WHERE turma_id = p_turma_id
    AND data_aula = p_data_aula;

  -- Cria se não existir
  IF v_sessao_id IS NULL THEN
    INSERT INTO public.sessoes (turma_id, data_aula, status)
    VALUES (p_turma_id, p_data_aula, 'realizada')
    RETURNING id INTO v_sessao_id;
  END IF;

  RETURN v_sessao_id;
END;
$$;

COMMENT ON VIEW public.vw_chamada_sessao IS 'Tela de frequência do professor: todos os alunos da sessão, sem distinção de unidade. Badge de unidade para contexto visual.';
COMMENT ON VIEW public.vw_financeiro_por_unidade IS 'Relatório financeiro: cada linha é um pagamento com sua unidade financeira. Pivô: matriculas.unidade_id.';
COMMENT ON VIEW public.vw_kpi_financeiro_mensal IS 'Dashboard: totais de receita, inadimplência e a_receber por unidade e mês.';
COMMENT ON FUNCTION public.fn_obter_ou_criar_sessao IS 'Cria sessão de aula se não existir para o dia, ou retorna a existente. Usar no endpoint de abertura de chamada.';
