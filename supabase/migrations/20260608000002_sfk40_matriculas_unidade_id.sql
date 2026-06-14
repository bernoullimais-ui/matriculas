-- ============================================================
-- MIGRATION SFK 4.0 — PASSO 2: Coluna unidade_id em matriculas
-- Adiciona o campo de segregação financeira sem remover o campo
-- `unidade` (texto) existente — compatibilidade retroativa total.
-- ============================================================

-- 1. Adicionar a nova coluna de FK (nullable inicialmente para não quebrar dados)
ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);

-- 2. Backfill: preencher unidade_id baseado no campo texto `unidade` existente
UPDATE public.matriculas m
SET unidade_id = u.id
FROM public.unidades u
WHERE LOWER(TRIM(m.unidade)) = LOWER(TRIM(u.nome))
  AND m.unidade_id IS NULL;

-- 3. Criar index para performance nos relatórios financeiros
CREATE INDEX IF NOT EXISTS idx_matriculas_unidade_id
  ON public.matriculas(unidade_id);

CREATE INDEX IF NOT EXISTS idx_matriculas_aluno_unidade
  ON public.matriculas(aluno_id, unidade_id);

-- 4. Adicionar coluna unidade_origem_id em alunos
--    (identifica a qual unidade o aluno pertence operacionalmente)
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS unidade_origem_id UUID REFERENCES public.unidades(id);

-- 5. Backfill: inferir unidade de origem pelo campo `unidade` da matrícula ativa mais recente
--    (regra: o aluno "pertence" à unidade da sua matrícula ativa mais recente)
UPDATE public.alunos a
SET unidade_origem_id = subq.unidade_id
FROM (
  SELECT DISTINCT ON (m.aluno_id)
    m.aluno_id,
    m.unidade_id
  FROM public.matriculas m
  WHERE m.unidade_id IS NOT NULL
    AND m.status IN ('ativo', 'Ativo', 'ativa')
  ORDER BY m.aluno_id, m.created_at DESC
) subq
WHERE a.id = subq.aluno_id
  AND a.unidade_origem_id IS NULL;

-- 6. Criar index para relatórios operacionais por unidade
CREATE INDEX IF NOT EXISTS idx_alunos_unidade_origem
  ON public.alunos(unidade_origem_id);

COMMENT ON COLUMN public.matriculas.unidade_id IS '🔑 PIVÔ FINANCEIRO SFK 4.0: unidade financeira responsável por esta matrícula. Nunca use alunos.unidade_origem_id para relatórios financeiros.';
COMMENT ON COLUMN public.alunos.unidade_origem_id IS 'Unidade operacional de origem do aluno (Dom Pedrinho ou Kids Sport Club). Apenas para relatórios operacionais/cadastro.';
