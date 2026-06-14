-- Histórico de movimentações de estoque
CREATE TABLE IF NOT EXISTS loja_produto_historico_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid REFERENCES loja_produtos(id) ON DELETE CASCADE,
  variante_key text NOT NULL DEFAULT 'default', -- ex: 'Azul-P' ou 'default'
  quantidade int NOT NULL,
  tipo text NOT NULL DEFAULT 'entrada', -- 'entrada' (adição/compra), 'saida' (venda/correção)
  motivo text DEFAULT 'adicao', -- 'estoque_inicial', 'compra', 'venda', 'correcao'
  created_at timestamptz DEFAULT now()
);

-- Desabilitar RLS para facilitar integração
ALTER TABLE loja_produto_historico_estoque DISABLE ROW LEVEL SECURITY;
