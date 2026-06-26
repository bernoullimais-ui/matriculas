-- Criar tabela de controle de lotes de cupons
CREATE TABLE IF NOT EXISTS cupons_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefixo text NOT NULL,
  quantidade int NOT NULL,
  tipo_desconto text NOT NULL, -- 'porcentagem' | 'valor_fixo'
  valor numeric(10,2) NOT NULL,
  unidade text, -- Unidade parceira opcional de restrição
  turma_id uuid REFERENCES turmas(id) ON DELETE SET NULL, -- Curso de restrição
  validade timestamptz,
  limite_por_usuario int DEFAULT 1, -- Limite de uso configurável por cliente
  plano_registro text, -- Nome do plano que será gravado na matrícula (ex: 'Integral Dom Pedrinho')
  aplicar_em text DEFAULT 'todas_parcelas',
  created_at timestamptz DEFAULT now()
);

-- Adicionar colunas na tabela cupons
ALTER TABLE cupons ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES cupons_lotes(id) ON DELETE CASCADE;
ALTER TABLE cupons ADD COLUMN IF NOT EXISTS unidade text; -- Unidade parceira opcional de restrição individual
ALTER TABLE cupons ADD COLUMN IF NOT EXISTS plano_registro text; -- Nome do plano personalizado
