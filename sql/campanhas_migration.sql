-- =====================================================================
-- MIGRATION: Módulo de Gestão de Campanhas — Sport For Kids
-- Executar no Supabase SQL Editor
-- =====================================================================

-- 1. Tabela principal de campanhas
CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'rascunho',
  tipo            TEXT NOT NULL DEFAULT 'ambos',
  criado_por      TEXT,
  data_inicio     DATE,
  data_fim        DATE,
  agendado_para   TIMESTAMPTZ,
  disparado_em    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. Segmentação do público-alvo
CREATE TABLE IF NOT EXISTS campaign_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  tipo_alvo     TEXT NOT NULL,
  valor_alvo    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 3. Configuração do e-mail da campanha
CREATE TABLE IF NOT EXISTS campaign_emails (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  assunto         TEXT NOT NULL,
  formato         TEXT NOT NULL DEFAULT 'texto',
  conteudo        TEXT,
  imagem_url      TEXT,
  remetente_email TEXT,
  remetente_nome  TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 4. Landing page da campanha
CREATE TABLE IF NOT EXISTS campaign_landing_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  titulo            TEXT NOT NULL DEFAULT '',
  descricao         TEXT,
  banner_url        TEXT,
  video_url         TEXT,
  preco_original    DECIMAL(10,2),
  preco_promocional DECIMAL(10,2),
  condicao_texto    TEXT,
  cta_texto         TEXT DEFAULT 'Quero me Matricular',
  cta_url           TEXT,
  cor_primaria      TEXT DEFAULT '#4f46e5',
  ativa             BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- 5. Métricas agregadas por campanha
CREATE TABLE IF NOT EXISTS campaign_metrics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID UNIQUE NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  emails_enviados     INTEGER DEFAULT 0,
  emails_entregues    INTEGER DEFAULT 0,
  emails_abertos      INTEGER DEFAULT 0,
  cliques             INTEGER DEFAULT 0,
  visitas_lp          INTEGER DEFAULT 0,
  leads_gerados       INTEGER DEFAULT 0,
  matriculas_geradas  INTEGER DEFAULT 0,
  valor_gerado        DECIMAL(10,2) DEFAULT 0,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- 6. Log individual de cada e-mail enviado
CREATE TABLE IF NOT EXISTS campaign_sends (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  aluno_id      TEXT,
  email_dest    TEXT NOT NULL,
  nome_dest     TEXT,
  status        TEXT DEFAULT 'enviado',
  brevo_msg_id  TEXT,
  enviado_em    TIMESTAMPTZ DEFAULT now()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign_id ON campaign_targets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_campaign_id ON campaign_emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_lp_campaign_id ON campaign_landing_pages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign_id ON campaign_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign_id ON campaign_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON campaigns(slug);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Políticas RLS permissivas (alinhado com padrão do projeto)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_all" ON campaigns;
DROP POLICY IF EXISTS "campaign_targets_all" ON campaign_targets;
DROP POLICY IF EXISTS "campaign_emails_all" ON campaign_emails;
DROP POLICY IF EXISTS "campaign_landing_pages_all" ON campaign_landing_pages;
DROP POLICY IF EXISTS "campaign_metrics_all" ON campaign_metrics;
DROP POLICY IF EXISTS "campaign_sends_all" ON campaign_sends;

CREATE POLICY "campaigns_all" ON campaigns FOR ALL USING (true);
CREATE POLICY "campaign_targets_all" ON campaign_targets FOR ALL USING (true);
CREATE POLICY "campaign_emails_all" ON campaign_emails FOR ALL USING (true);
CREATE POLICY "campaign_landing_pages_all" ON campaign_landing_pages FOR ALL USING (true);
CREATE POLICY "campaign_metrics_all" ON campaign_metrics FOR ALL USING (true);
CREATE POLICY "campaign_sends_all" ON campaign_sends FOR ALL USING (true);

-- Trigger para atualizar updated_at das campanhas
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaigns_updated_at ON campaigns;
CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_campaigns_updated_at();
