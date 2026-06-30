-- Tabela de configurações da Nota Fiscal
CREATE TABLE IF NOT EXISTS configuracoes_nf (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    frequencia TEXT NOT NULL DEFAULT 'diario' CHECK (frequencia IN ('imediato', 'diario', 'semanal', 'mensal')),
    dia_semana INTEGER, -- 0 (Domingo) a 6 (Sábado)
    dia_mes INTEGER, -- 1 a 31
    brevo_template_id INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE configuracoes_nf ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso Publico configuracoes_nf" ON configuracoes_nf FOR ALL USING (true);

-- Inserir configuração padrão se não existir
INSERT INTO configuracoes_nf (frequencia)
SELECT 'diario'
WHERE NOT EXISTS (SELECT 1 FROM configuracoes_nf);
