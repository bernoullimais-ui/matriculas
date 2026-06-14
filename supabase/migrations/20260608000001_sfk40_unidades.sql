-- ============================================================
-- MIGRATION SFK 4.0 — PASSO 1: Tabela de Unidades
-- Cria a tabela canônica de unidades (identidades de atendimento)
-- e popula com os dados existentes da tabela `identidades`.
-- NÃO altera nenhuma tabela existente. Totalmente segura.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.unidades (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'externa', -- 'interna' | 'externa'
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir as duas identidades do sistema
INSERT INTO public.unidades (nome, slug, tipo) VALUES
  ('Dom Pedrinho',    'dom-pedrinho',    'interna'),
  ('Kids Sport Club', 'kids-sport-club', 'externa')
ON CONFLICT (slug) DO NOTHING;

-- Tabela de junção: quais unidades operam em cada turma
-- Para turmas exclusivas: 1 registro. Para compartilhadas: 2 registros.
CREATE TABLE IF NOT EXISTS public.turma_unidades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id    UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  unidade_id  UUID NOT NULL REFERENCES public.unidades(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (turma_id, unidade_id)
);

-- Coluna para indicar se a turma é compartilhada ou exclusiva
ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS tipo_turma TEXT NOT NULL DEFAULT 'exclusiva';
  -- Valores válidos: 'exclusiva' | 'compartilhada'

-- Popular turma_unidades a partir de unidade_nome já existente em turmas
-- (Para cada turma que já tem unidade_nome preenchido)
INSERT INTO public.turma_unidades (turma_id, unidade_id)
SELECT
  t.id AS turma_id,
  u.id AS unidade_id
FROM public.turmas t
INNER JOIN public.unidades u
  ON LOWER(TRIM(u.nome)) = LOWER(TRIM(COALESCE(t.unidade_nome, '')))
WHERE t.unidade_nome IS NOT NULL AND TRIM(t.unidade_nome) != ''
ON CONFLICT (turma_id, unidade_id) DO NOTHING;

COMMENT ON TABLE public.unidades IS 'Identidades de atendimento do SFK 4.0: Dom Pedrinho (interna) e Kids Sport Club (externa)';
COMMENT ON TABLE public.turma_unidades IS 'Relação N:N entre turmas e unidades. Turmas compartilhadas terão 2 registros aqui.';
COMMENT ON COLUMN public.turmas.tipo_turma IS 'exclusiva = só uma unidade; compartilhada = alunos de múltiplas unidades na mesma aula';
