-- Categorias da loja
CREATE TABLE IF NOT EXISTS loja_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE NOT NULL,
  descricao text,
  ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Produtos da loja
CREATE TABLE IF NOT EXISTS loja_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid REFERENCES loja_categorias(id) ON DELETE SET NULL,
  nome text NOT NULL,
  slug text UNIQUE NOT NULL,
  descricao text,
  preco numeric(10,2) NOT NULL,
  preco_promocional numeric(10,2),
  imagens text[] DEFAULT '{}',
  variantes jsonb DEFAULT '[]',
  estoque_por_variante jsonb DEFAULT '{}',
  ativo boolean DEFAULT true,
  destaque boolean DEFAULT false,
  unidade_nome text,
  created_at timestamptz DEFAULT now()
);

-- Pedidos da loja
CREATE TABLE IF NOT EXISTS loja_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  responsavel_id uuid,
  status text DEFAULT 'aguardando_pagamento',
  total numeric(10,2) NOT NULL,
  metodo_pagamento text,
  pagarme_order_id text,
  pagarme_charge_id text,
  observacoes text,
  endereco_entrega jsonb,
  tipo_entrega text DEFAULT 'retirada',
  nome_cliente text,
  email_cliente text,
  telefone_cliente text,
  created_at timestamptz DEFAULT now()
);

-- Itens do pedido
CREATE TABLE IF NOT EXISTS loja_pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES loja_pedidos(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES loja_produtos(id) ON DELETE SET NULL,
  nome_produto text NOT NULL,
  variante_selecionada jsonb,
  quantidade int NOT NULL DEFAULT 1,
  preco_unitario numeric(10,2) NOT NULL
);

-- Eventos
CREATE TABLE IF NOT EXISTS eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  slug text UNIQUE NOT NULL,
  tipo text NOT NULL DEFAULT 'evento',
  descricao text,
  data_inicio timestamptz NOT NULL,
  data_fim timestamptz,
  local text,
  unidade_nome text,
  imagem_capa text,
  vagas_total int,
  taxa_inscricao numeric(10,2) DEFAULT 0,
  gratuito boolean DEFAULT true,
  status text DEFAULT 'publicado',
  categorias_inscricao jsonb DEFAULT '[]',
  apenas_alunos boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Inscrições em eventos
CREATE TABLE IF NOT EXISTS evento_inscricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid REFERENCES eventos(id) ON DELETE CASCADE,
  responsavel_id uuid,
  aluno_id uuid,
  categoria text,
  status text DEFAULT 'inscrito',
  taxa_paga boolean DEFAULT false,
  pagarme_order_id text,
  observacoes text,
  numero_inscricao text UNIQUE,
  nome_aluno text,
  nome_responsavel text,
  email_responsavel text,
  created_at timestamptz DEFAULT now()
);

-- Popular dados iniciais de categorias
INSERT INTO loja_categorias (nome, slug, descricao, ordem) VALUES
  ('Uniformes', 'uniformes', 'Camisetas, shorts e conjuntos oficiais', 1),
  ('Acessórios', 'acessorios', 'Bolsas, mochilas e equipamentos', 2),
  ('Kits', 'kits', 'Kits completos por modalidade', 3)
ON CONFLICT (slug) DO NOTHING;
