-- config_financeira_unidades
CREATE TABLE config_financeira_unidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unidade_id UUID REFERENCES unidades(id) ON DELETE CASCADE,
  tipo_repasse tipo_repasse_unidade_enum NOT NULL,
  percentual_repasse NUMERIC(5, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(unidade_id)
);

-- fechamentos_b2b_mensal
CREATE TABLE fechamentos_b2b_mensal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unidade_id UUID REFERENCES unidades(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,
  valor_arrecadado NUMERIC(10, 2) NOT NULL DEFAULT 0,
  valor_repasse NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status status_fechamento_enum DEFAULT 'ABERTO',
  json_detalhamento JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(unidade_id, mes_referencia)
);
