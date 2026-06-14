-- Adicionar coluna status_entrega na tabela loja_pedidos
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS status_entrega text DEFAULT 'pendente';
