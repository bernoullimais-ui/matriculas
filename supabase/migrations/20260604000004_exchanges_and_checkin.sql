-- Tabela para gerenciar solicitações de troca/devolução
CREATE TABLE IF NOT EXISTS loja_pedidos_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES loja_pedidos(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- 'troca_tamanho' | 'substituicao' | 'devolucao'
  detalhes text NOT NULL,
  status text DEFAULT 'pendente', -- 'pendente' | 'aprovado' | 'rejeitado' | 'concluido'
  created_at timestamptz DEFAULT now()
);

ALTER TABLE loja_pedidos_solicitacoes DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo para loja_pedidos_solicitacoes" ON loja_pedidos_solicitacoes;
CREATE POLICY "Permitir tudo para loja_pedidos_solicitacoes" ON loja_pedidos_solicitacoes FOR ALL USING (true) WITH CHECK (true);

-- Adicionar coluna checkin se não existir na tabela de inscrições
ALTER TABLE evento_inscricoes ADD COLUMN IF NOT EXISTS checkin boolean DEFAULT false;
