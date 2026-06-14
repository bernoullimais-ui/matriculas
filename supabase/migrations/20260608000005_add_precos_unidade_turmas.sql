-- ============================================================
-- MIGRATION SFK 4.0: Adicionar precos_unidade na tabela turmas
-- ============================================================

ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS precos_unidade JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.turmas.precos_unidade IS 'Map of unit names to custom prices for this class. Ex: {"Dom Pedrinho": 180.00}';
