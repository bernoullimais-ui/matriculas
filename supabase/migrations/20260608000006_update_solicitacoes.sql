ALTER TABLE loja_pedidos_solicitacoes 
ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES loja_pedido_itens(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS novo_produto_id uuid REFERENCES loja_produtos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS nova_variante jsonb,
ADD COLUMN IF NOT EXISTS diferenca_valor numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS autorizador_id uuid,
ADD COLUMN IF NOT EXISTS cupom_gerado_id uuid REFERENCES cupons(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS link_pagamento_gerado text,
ADD COLUMN IF NOT EXISTS data_autorizacao timestamptz;
