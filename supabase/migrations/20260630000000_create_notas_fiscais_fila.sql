-- Tabela de fila de Notas Fiscais
CREATE TABLE IF NOT EXISTS notas_fiscais_fila (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pagamento_id TEXT NOT NULL, -- referenciando o id em pagamentos (pode ser UUID ou TEXT)
    tipo_nota TEXT NOT NULL CHECK (tipo_nota IN ('NFSe', 'NFe')),
    status TEXT NOT NULL DEFAULT 'pendente',
    focus_id TEXT,
    nfe_numero TEXT,
    nfe_url_pdf TEXT,
    nfe_url_xml TEXT,
    dados_emissao JSONB,
    mensagem_erro TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar colunas em alunos caso não existam (Endereço e CPF)
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS endereco_cep TEXT;
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT;
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS endereco_numero TEXT;
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS endereco_complemento TEXT;
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS endereco_bairro TEXT;
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS endereco_cidade TEXT;
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS endereco_uf TEXT;

-- Políticas de RLS
ALTER TABLE notas_fiscais_fila ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso Publico notas_fiscais_fila" ON notas_fiscais_fila FOR ALL USING (true);
