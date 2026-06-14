-- Enums
CREATE TYPE tipo_contrato_enum AS ENUM ('CLT_HORISTA', 'CLT_INTERMITENTE', 'PJ_REPASSE', 'FIXO');
CREATE TYPE tipo_repasse_unidade_enum AS ENUM ('SEDE_PARA_UNIDADE', 'UNIDADE_PARA_SEDE', 'B2B_INTEGRAL');
CREATE TYPE status_fechamento_enum AS ENUM ('ABERTO', 'EM_ANALISE', 'FECHADO', 'PAGO');
CREATE TYPE tipo_lancamento_folha_enum AS ENUM ('PROVENTO', 'DESCONTO');

-- config_financeira_colaboradores
CREATE TABLE config_financeira_colaboradores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_contrato tipo_contrato_enum NOT NULL,
  valor_hora_aula NUMERIC(10, 2),
  percentual_repasse_padrao NUMERIC(5, 2),
  aplica_vt BOOLEAN DEFAULT false,
  custo_mensal_vt NUMERIC(10, 2),
  salario_base NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(usuario_id)
);

-- repasses_turma_pj
CREATE TABLE repasses_turma_pj (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turma_id UUID REFERENCES turmas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  percentual_repasse NUMERIC(5, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(turma_id, usuario_id)
);

-- lancamentos_folha_avulsos
CREATE TABLE lancamentos_folha_avulsos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,
  tipo tipo_lancamento_folha_enum NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- folhas_pagamento_mensal
CREATE TABLE folhas_pagamento_mensal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,
  valor_bruto NUMERIC(10, 2) NOT NULL,
  valor_descontos NUMERIC(10, 2) NOT NULL,
  valor_liquido NUMERIC(10, 2) NOT NULL,
  status status_fechamento_enum DEFAULT 'ABERTO',
  json_detalhamento JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(usuario_id, mes_referencia)
);
