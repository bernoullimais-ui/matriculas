-- Migration para adicionar campos de controle do PIX Exceção

ALTER TABLE matriculas 
  ADD COLUMN IF NOT EXISTS motivo_excecao_pix TEXT,
  ADD COLUMN IF NOT EXISTS criado_por_admin_id TEXT,
  ADD COLUMN IF NOT EXISTS tipo_pagamento TEXT DEFAULT 'cartao_credito';
