-- Migration: Tabela de Conversas WhatsApp (Agente Sofia)
-- Execute no Supabase Dashboard > SQL Editor

-- 1. Tabela principal de sessões/conversas
CREATE TABLE IF NOT EXISTS conversas_whatsapp (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone            TEXT NOT NULL,
  aluno_ids           JSONB DEFAULT '[]',          -- IDs dos alunos vinculados ao telefone
  responsavel_nome    TEXT,                          -- Nome do responsável identificado
  identidade_nome     TEXT,                          -- Unidade/identidade associada
  historico           JSONB NOT NULL DEFAULT '[]',  -- Array de {role, parts} para o Gemini
  status              TEXT NOT NULL DEFAULT 'ativo', -- 'ativo' | 'escalado' | 'encerrado'
  escalado_at         TIMESTAMPTZ,
  encerrado_at        TIMESTAMPTZ,
  ultima_mensagem_at  TIMESTAMPTZ DEFAULT now(),
  total_mensagens     INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- 2. Coluna para nome customizável do agente IA por identidade
ALTER TABLE identidades 
  ADD COLUMN IF NOT EXISTS nome_agente_ia TEXT DEFAULT 'Sofia';

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_conversas_telefone 
  ON conversas_whatsapp(telefone);

CREATE INDEX IF NOT EXISTS idx_conversas_status 
  ON conversas_whatsapp(status);

CREATE INDEX IF NOT EXISTS idx_conversas_ultima_msg 
  ON conversas_whatsapp(ultima_mensagem_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversas_identidade 
  ON conversas_whatsapp(identidade_nome);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE conversas_whatsapp ENABLE ROW LEVEL SECURITY;

-- 5. Política de acesso (service role tem acesso total, igual as demais tabelas)
DROP POLICY IF EXISTS "Acesso Publico conversas_whatsapp" ON conversas_whatsapp;
CREATE POLICY "Acesso Publico conversas_whatsapp" 
  ON conversas_whatsapp FOR ALL USING (true);

-- 6. Comentários de documentação
COMMENT ON TABLE conversas_whatsapp IS 'Sessões e histórico de conversas do Agente Sofia via WhatsApp';
COMMENT ON COLUMN conversas_whatsapp.historico IS 'Array de mensagens no formato Gemini: [{role: "user"|"model", parts: [{text: "..."}]}]';
COMMENT ON COLUMN conversas_whatsapp.status IS 'ativo: Sofia está respondendo; escalado: aguarda atendimento humano; encerrado: sessão finalizada';
COMMENT ON COLUMN identidades.nome_agente_ia IS 'Nome da assistente virtual de IA para esta unidade (padrão: Sofia)';
