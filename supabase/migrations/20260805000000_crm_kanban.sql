-- Migration: CRM Kanban
-- Tabelas: crm_pipelines, crm_etapas, crm_cards, crm_movimentacoes

CREATE TABLE IF NOT EXISTS crm_pipelines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  descricao   TEXT,
  ativo       BOOLEAN DEFAULT true,
  ordem       INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_etapas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id   UUID REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  cor           TEXT DEFAULT '#6366f1',
  icone         TEXT,
  ordem         INT DEFAULT 0,
  tipo          TEXT DEFAULT 'customizado',
  requer_motivo BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID REFERENCES crm_pipelines(id) ON DELETE SET NULL,
  etapa_id        UUID REFERENCES crm_etapas(id) ON DELETE SET NULL,
  conversa_id     UUID,
  responsavel_id  UUID,
  aluno_id        UUID,
  telefone        TEXT,
  nome_contato    TEXT,
  unidade         TEXT,
  identidade_nome TEXT,
  turma_interesse TEXT,
  prioridade      TEXT DEFAULT 'media',
  etiquetas       TEXT[] DEFAULT '{}',
  notas           TEXT,
  motivo_perda    TEXT,
  avatar_url      TEXT,
  data_followup   DATE,
  ordem_coluna    INT DEFAULT 0,
  movido_por      TEXT DEFAULT 'manual',
  nao_lidas       INT DEFAULT 0,
  criado_por      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_movimentacoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id        UUID REFERENCES crm_cards(id) ON DELETE CASCADE,
  etapa_origem   UUID REFERENCES crm_etapas(id) ON DELETE SET NULL,
  etapa_destino  UUID REFERENCES crm_etapas(id) ON DELETE SET NULL,
  motivo         TEXT,
  tipo           TEXT DEFAULT 'manual',
  movido_por     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_cards_pipeline    ON crm_cards(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_cards_etapa       ON crm_cards(etapa_id);
CREATE INDEX IF NOT EXISTS idx_crm_cards_telefone    ON crm_cards(telefone);
CREATE INDEX IF NOT EXISTS idx_crm_cards_unidade     ON crm_cards(unidade);
CREATE INDEX IF NOT EXISTS idx_crm_movimentacoes_card ON crm_movimentacoes(card_id);

CREATE OR REPLACE FUNCTION update_crm_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_cards_updated_at ON crm_cards;
CREATE TRIGGER trg_crm_cards_updated_at
  BEFORE UPDATE ON crm_cards
  FOR EACH ROW EXECUTE FUNCTION update_crm_cards_updated_at();

INSERT INTO crm_pipelines (id, nome, descricao, ordem) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Funil de Vendas', 'Captação e conversão de novos alunos', 0),
  ('22222222-2222-2222-2222-222222222222', 'Funil de Retenção', 'Pós-venda, onboarding e prevenção de churn', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO crm_etapas (id, pipeline_id, nome, cor, icone, ordem, tipo, requer_motivo) VALUES
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Lead',       '#6366f1', 'User',          0, 'lead',        false),
  ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Agendado',   '#f59e0b', 'Calendar',      1, 'agendado',    false),
  ('a3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Follow-up',  '#3b82f6', 'Phone',         2, 'follow_up',   false),
  ('a4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Matriculado','#10b981', 'CheckCircle',   3, 'matriculado', false),
  ('a5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Desistente', '#ef4444', 'XCircle',       4, 'desistente',  true),
  ('b1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Onboarding',     '#8b5cf6', 'Rocket',       0, 'onboarding',  false),
  ('b2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Ativo',          '#10b981', 'Star',         1, 'ativo',       false),
  ('b3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Em Risco',       '#f97316', 'AlertTriangle',2, 'customizado', false),
  ('b4444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Risco de Churn', '#ef4444', 'TrendingDown', 3, 'risco_churn', false),
  ('b5555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'Cancelado',      '#6b7280', 'Archive',      4, 'cancelamento',true)
ON CONFLICT (id) DO NOTHING;
