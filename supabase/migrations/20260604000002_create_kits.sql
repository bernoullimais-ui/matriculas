-- Adicionar flag de kit na tabela de produtos
ALTER TABLE loja_produtos ADD COLUMN IF NOT EXISTS is_kit boolean DEFAULT false;

-- Tabela de itens/componentes que compõem o kit
CREATE TABLE IF NOT EXISTS loja_kit_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_produto_id uuid REFERENCES loja_produtos(id) ON DELETE CASCADE,
  componente_produto_id uuid REFERENCES loja_produtos(id) ON DELETE CASCADE,
  componente_variante_key text NOT NULL DEFAULT 'default', -- ex: 'Azul - P' ou 'default'
  quantidade int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Desabilitar RLS
ALTER TABLE loja_kit_itens DISABLE ROW LEVEL SECURITY;
