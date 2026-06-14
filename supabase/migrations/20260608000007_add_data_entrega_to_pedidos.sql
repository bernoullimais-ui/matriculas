-- Migration para adicionar a data em que o pedido foi entregue para validar prazo de 7 dias
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS data_entrega timestamp with time zone;
