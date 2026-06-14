-- Tabela para gerenciar os cupons de desconto
CREATE TABLE IF NOT EXISTS cupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL, -- Código do cupom (Ex: PARCEIRO10, EVENTOS50)
  tipo_desconto text NOT NULL DEFAULT 'porcentagem', -- 'porcentagem' | 'valor_fixo'
  valor numeric(10,2) NOT NULL,
  
  -- Escopo do desconto
  escopo text NOT NULL, -- 'loja_todos' | 'loja_especifico' | 'eventos_todos' | 'eventos_especifico'
  produto_id uuid, -- ID opcional de produto ou kit específico da loja
  evento_id uuid, -- ID opcional de evento específico
  
  -- Restrições de uso
  limite_total_uso int, -- Qtd máxima global de usos do cupom
  limite_por_usuario int DEFAULT 1, -- Qtd máxima de usos por responsável (CPF/ID)
  validade timestamptz, -- Data/hora limite de uso
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Tabela de histórico/uso de cupons
CREATE TABLE IF NOT EXISTS cupom_usos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cupom_id uuid REFERENCES cupons(id) ON DELETE CASCADE,
  responsavel_id uuid, -- ID do responsável que utilizou
  pedido_id uuid REFERENCES loja_pedidos(id) ON DELETE CASCADE, -- Se usado na loja
  inscricao_id uuid REFERENCES evento_inscricoes(id) ON DELETE CASCADE, -- Se usado em eventos
  created_at timestamptz DEFAULT now()
);

-- Desabilitar RLS para cupons por simplicidade
ALTER TABLE cupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE cupom_usos DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo para cupons" ON cupons;
CREATE POLICY "Permitir tudo para cupons" ON cupons FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo para cupom_usos" ON cupom_usos;
CREATE POLICY "Permitir tudo para cupom_usos" ON cupom_usos FOR ALL USING (true) WITH CHECK (true);

-- Adicionar colunas opcionais de cupom_id nas tabelas originais
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS cupom_id uuid REFERENCES cupons(id) ON DELETE SET NULL;
ALTER TABLE evento_inscricoes ADD COLUMN IF NOT EXISTS cupom_id uuid REFERENCES cupons(id) ON DELETE SET NULL;
