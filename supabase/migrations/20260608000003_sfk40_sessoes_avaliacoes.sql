-- ============================================================
-- MIGRATION SFK 4.0 — PASSO 3: Tabela de Sessões
-- Representa cada ocorrência real de uma aula (instância do horário
-- recorrente). É o ponto neutro para frequência e avaliações.
-- A tabela `presencas` existente será vinculada às sessões.
-- ============================================================

-- 1. Criar tabela de sessões (ocorrências de aula)
CREATE TABLE IF NOT EXISTS public.sessoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id     UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  data_aula    DATE NOT NULL,
  hora_inicio  TIME,
  hora_fim     TIME,
  status       TEXT NOT NULL DEFAULT 'realizada',
                -- 'realizada' | 'cancelada' | 'reposta' | 'planejada'
  observacoes  TEXT,
  created_by   UUID, -- referência ao usuário que lançou
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (turma_id, data_aula)
);

-- 2. Adicionar coluna sessao_id na tabela presencas existente
ALTER TABLE public.presencas
  ADD COLUMN IF NOT EXISTS sessao_id UUID REFERENCES public.sessoes(id);

-- 3. Index de performance para listagem de chamada por sessão
CREATE INDEX IF NOT EXISTS idx_sessoes_turma_data
  ON public.sessoes(turma_id, data_aula DESC);

CREATE INDEX IF NOT EXISTS idx_presencas_sessao
  ON public.presencas(sessao_id);

-- 4. Criar tabela de avaliações pedagógicas (sem contexto de unidade)
CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id       UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  turma_id       UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  data_avaliacao DATE NOT NULL DEFAULT CURRENT_DATE,
  criterio       TEXT NOT NULL,  -- 'tecnica' | 'comportamento' | 'evolucao' | 'nota_geral'
  nota           NUMERIC(4,2),
  conceito       TEXT,           -- 'A' | 'B' | 'C' | 'D' (alternativa à nota numérica)
  observacoes    TEXT,
  avaliador_id   UUID,           -- usuário que lançou
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_aluno_turma
  ON public.avaliacoes(aluno_id, turma_id, data_avaliacao DESC);

COMMENT ON TABLE public.sessoes IS 'Cada ocorrência real de uma aula. Ponto neutro para frequência e avaliações (sem contexto de unidade).';
COMMENT ON TABLE public.avaliacoes IS 'Avaliações pedagógicas. Sem contexto de unidade — o professor vê e avalia todos os alunos igualmente.';
COMMENT ON COLUMN public.presencas.sessao_id IS 'FK para sessoes: vincula a presença a uma ocorrência específica de aula.';
