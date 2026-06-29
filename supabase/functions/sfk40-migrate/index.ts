/**
 * SFK 4.0 — Edge Function temporária para migrations
 * Executa DDL SQL via conexão direta ao banco (Deno + postgres)
 * REMOVER APÓS USO
 */

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sfk-secret",
};

const SECRET = "sfk40-migrate-2026";

// SQL Steps
const steps = [
  {
    name: "CREATE TABLE unidades",
    sql: `CREATE TABLE IF NOT EXISTS public.unidades (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome       TEXT NOT NULL,
      slug       TEXT UNIQUE NOT NULL,
      tipo       TEXT NOT NULL DEFAULT 'externa',
      ativo      BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
  },
  {
    name: "ADD COLUMN unidades.tipo (if missing)",
    sql: `ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'externa'`,
  },
  {
    name: "ADD COLUMN unidades.ativo (if missing)",
    sql: `ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true`,
  },
  {
    name: "INSERT unidades",
    sql: `INSERT INTO public.unidades (nome, slug, tipo) VALUES
      ('Escola Dom Pedrinho',  'dom-pedrinho',    'interna'),
      ('Kids Sport Club',      'kids-sport-club', 'externa'),
      ('Colégio Bernoulli',    'bernoulli',       'externa'),
      ('Escola Pequeno Liceu', 'pequeno-liceu',   'externa'),
      ('Colégio Bunny',        'bunny',           'externa'),
      ('Colégio Oficina',      'oficina',         'externa'),
      ('AKA Dojo',             'aka-dojo',        'externa'),
      ('FLUIR Pituba',         'fluir_pituba',    'externa')
    ON CONFLICT (slug) DO NOTHING`,
  },
  {
    name: "CREATE TABLE turma_unidades",
    sql: `CREATE TABLE IF NOT EXISTS public.turma_unidades (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      turma_id    UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
      unidade_id  UUID NOT NULL REFERENCES public.unidades(id) ON DELETE RESTRICT,
      created_at  TIMESTAMPTZ DEFAULT now(),
      UNIQUE (turma_id, unidade_id)
    )`,
  },
  {
    name: "ADD COLUMN turmas.tipo_turma",
    sql: `ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS tipo_turma TEXT NOT NULL DEFAULT 'exclusiva'`,
  },
  {
    name: "BACKFILL turma_unidades",
    sql: `INSERT INTO public.turma_unidades (turma_id, unidade_id)
    SELECT t.id, u.id
    FROM public.turmas t
    INNER JOIN public.unidades u ON LOWER(TRIM(u.nome)) = LOWER(TRIM(COALESCE(t.unidade_nome, '')))
    WHERE t.unidade_nome IS NOT NULL AND TRIM(t.unidade_nome) != ''
    ON CONFLICT (turma_id, unidade_id) DO NOTHING`,
  },
  {
    name: "ADD COLUMN matriculas.unidade_id",
    sql: `ALTER TABLE public.matriculas ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id)`,
  },
  {
    name: "BACKFILL matriculas.unidade_id",
    sql: `UPDATE public.matriculas m
    SET unidade_id = u.id
    FROM public.unidades u
    WHERE LOWER(TRIM(m.unidade)) = LOWER(TRIM(u.nome)) AND m.unidade_id IS NULL`,
  },
  {
    name: "INDEX matriculas.unidade_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_matriculas_unidade_id ON public.matriculas(unidade_id)`,
  },
  {
    name: "ADD COLUMN alunos.unidade_origem_id",
    sql: `ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS unidade_origem_id UUID REFERENCES public.unidades(id)`,
  },
  {
    name: "BACKFILL alunos.unidade_origem_id",
    sql: `UPDATE public.alunos a
    SET unidade_origem_id = subq.unidade_id
    FROM (
      SELECT DISTINCT ON (m.aluno_id) m.aluno_id, m.unidade_id
      FROM public.matriculas m
      WHERE m.unidade_id IS NOT NULL AND m.status IN ('ativo', 'Ativo', 'ativa')
      ORDER BY m.aluno_id, m.created_at DESC
    ) subq
    WHERE a.id = subq.aluno_id AND a.unidade_origem_id IS NULL`,
  },
  {
    name: "INDEX alunos.unidade_origem_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_alunos_unidade_origem ON public.alunos(unidade_origem_id)`,
  },
  {
    name: "CREATE TABLE sessoes",
    sql: `CREATE TABLE IF NOT EXISTS public.sessoes (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      turma_id     UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
      data_aula    DATE NOT NULL,
      hora_inicio  TIME,
      hora_fim     TIME,
      status       TEXT NOT NULL DEFAULT 'realizada',
      observacoes  TEXT,
      created_at   TIMESTAMPTZ DEFAULT now(),
      UNIQUE (turma_id, data_aula)
    )`,
  },
  {
    name: "INDEX sessoes",
    sql: `CREATE INDEX IF NOT EXISTS idx_sessoes_turma_data ON public.sessoes(turma_id, data_aula DESC)`,
  },
  {
    name: "ADD COLUMN presencas.sessao_id",
    sql: `ALTER TABLE public.presencas ADD COLUMN IF NOT EXISTS sessao_id UUID REFERENCES public.sessoes(id)`,
  },
  {
    name: "INDEX presencas.sessao_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_presencas_sessao ON public.presencas(sessao_id)`,
  },
  {
    name: "CREATE TABLE avaliacoes",
    sql: `CREATE TABLE IF NOT EXISTS public.avaliacoes (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      aluno_id       UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
      turma_id       UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
      data_avaliacao DATE NOT NULL DEFAULT CURRENT_DATE,
      criterio       TEXT NOT NULL,
      nota           NUMERIC(4,2),
      conceito       TEXT,
      observacoes    TEXT,
      avaliador_id   UUID,
      created_at     TIMESTAMPTZ DEFAULT now()
    )`,
  },
  {
    name: "VIEW vw_chamada_sessao",
    sql: `CREATE OR REPLACE VIEW public.vw_chamada_sessao AS
    SELECT
      s.id AS sessao_id, s.data_aula, s.hora_inicio, s.status AS status_sessao,
      t.id AS turma_id, t.nome AS turma_nome, t.tipo_turma,
      a.id AS aluno_id, a.nome_completo AS aluno_nome, a.data_nascimento,
      u_origem.id AS unidade_origem_id, u_origem.nome AS unidade_origem, u_origem.slug AS unidade_origem_slug,
      m.id AS matricula_id, m.status AS status_matricula,
      p.status AS status_presenca, p.observacao AS observacao_presenca
    FROM public.sessoes s
    INNER JOIN public.turmas t ON t.id = s.turma_id
    INNER JOIN public.matriculas m ON m.turma_id = t.id AND m.status IN ('ativo', 'Ativo', 'ativa')
    INNER JOIN public.alunos a ON a.id = m.aluno_id
    LEFT JOIN public.unidades u_origem ON u_origem.id = a.unidade_origem_id
    LEFT JOIN public.presencas p ON p.sessao_id = s.id AND p.aluno_id::uuid = a.id`,
  },
  {
    name: "VIEW vw_financeiro_por_unidade",
    sql: `CREATE OR REPLACE VIEW public.vw_financeiro_por_unidade AS
    SELECT
      u.id AS unidade_id, u.nome AS unidade, u.slug AS unidade_slug,
      t.id AS turma_id, t.nome AS turma_nome, t.tipo_turma,
      a.id AS aluno_id, a.nome_completo AS aluno_nome,
      m.id AS matricula_id, m.status AS status_matricula, m.plano, m.data_matricula,
      p.id AS pagamento_id, p.valor, p.status AS status_pagamento,
      p.data_vencimento, p.data_pagamento, p.metodo_pagamento,
      DATE_TRUNC('month', p.data_vencimento) AS mes_competencia
    FROM public.matriculas m
    INNER JOIN public.unidades u ON u.id = m.unidade_id
    INNER JOIN public.alunos a ON a.id = m.aluno_id
    INNER JOIN public.turmas t ON t.id = m.turma_id
    INNER JOIN public.pagamentos p ON p.matricula_id = m.id`,
  },
  {
    name: "VIEW vw_kpi_financeiro_mensal",
    sql: `CREATE OR REPLACE VIEW public.vw_kpi_financeiro_mensal AS
    SELECT unidade_id, unidade, mes_competencia,
      COUNT(DISTINCT matricula_id) AS total_matriculas,
      COUNT(DISTINCT aluno_id) AS total_alunos,
      COUNT(pagamento_id) AS total_cobrancas,
      SUM(valor) AS receita_prevista,
      SUM(CASE WHEN status_pagamento = 'pago' THEN valor ELSE 0 END) AS receita_realizada,
      SUM(CASE WHEN status_pagamento = 'atrasado' THEN valor ELSE 0 END) AS inadimplencia,
      SUM(CASE WHEN status_pagamento = 'pendente' THEN valor ELSE 0 END) AS a_receber,
      SUM(CASE WHEN status_pagamento = 'falha' THEN valor ELSE 0 END) AS falhas
    FROM public.vw_financeiro_por_unidade
    GROUP BY unidade_id, unidade, mes_competencia`,
  },
  {
    name: "FUNCTION fn_obter_ou_criar_sessao",
    sql: `CREATE OR REPLACE FUNCTION public.fn_obter_ou_criar_sessao(
      p_turma_id UUID, p_data_aula DATE DEFAULT CURRENT_DATE
    ) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
    DECLARE v_sessao_id UUID;
    BEGIN
      SELECT id INTO v_sessao_id FROM public.sessoes WHERE turma_id = p_turma_id AND data_aula = p_data_aula;
      IF v_sessao_id IS NULL THEN
        INSERT INTO public.sessoes (turma_id, data_aula, status) VALUES (p_turma_id, p_data_aula, 'realizada') RETURNING id INTO v_sessao_id;
      END IF;
      RETURN v_sessao_id;
    END; $$`,
  },
  {
    name: "CREATE TABLE config_financeira_unidades",
    sql: `CREATE TABLE IF NOT EXISTS public.config_financeira_unidades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE,
      tipo_repasse tipo_repasse_unidade_enum NOT NULL,
      percentual_repasse NUMERIC(5, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(unidade_id)
    )`,
  },
  {
    name: "CREATE TABLE fechamentos_b2b_mensal",
    sql: `CREATE TABLE IF NOT EXISTS public.fechamentos_b2b_mensal (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE,
      mes_referencia DATE NOT NULL,
      valor_arrecadado NUMERIC(10, 2) NOT NULL DEFAULT 0,
      valor_repasse NUMERIC(10, 2) NOT NULL DEFAULT 0,
      status status_fechamento_enum DEFAULT 'ABERTO',
      json_detalhamento JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(unidade_id, mes_referencia)
    )`,
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const reqSecret = req.headers.get("x-sfk-secret") || "";
  if (reqSecret !== SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get DATABASE_URL from Supabase env (available in Edge Functions)
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(
      JSON.stringify({ error: "DATABASE_URL não disponível. Use a variável SUPABASE_DB_URL." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Import postgres driver (Deno)
  const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.4/mod.js");
  const sql = postgres(dbUrl, { ssl: "require", max: 1 });

  const results: { step: string; status: string; error?: string }[] = [];

  try {
    for (const step of steps) {
      try {
        await sql.unsafe(step.sql);
        results.push({ step: step.name, status: "✅ ok" });
      } catch (e: any) {
        const msg = e.message || "";
        if (
          msg.includes("already exists") ||
          msg.includes("42P07") ||
          msg.includes("42701") ||
          msg.includes("duplicate key")
        ) {
          results.push({ step: step.name, status: "⚠️ já existe (ignorado)" });
        } else {
          results.push({ step: step.name, status: "❌ erro", error: msg });
        }
      }
    }

    // Post-migration verification
    const unidades = await sql`SELECT nome, slug, tipo FROM public.unidades ORDER BY nome`;
    const [{ total }] = await sql`SELECT COUNT(*) as total FROM public.matriculas WHERE status IN ('ativo', 'Ativo', 'ativa')`;
    const [{ com_id }] = await sql`SELECT COUNT(*) as com_id FROM public.matriculas WHERE status IN ('ativo', 'Ativo', 'ativa') AND unidade_id IS NOT NULL`;

    await sql.end();

    return new Response(
      JSON.stringify({
        success: true,
        results,
        verification: {
          unidades,
          matriculas_total: total,
          matriculas_com_unidade: com_id,
          matriculas_sem_unidade: Number(total) - Number(com_id),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    await sql.end().catch(() => {});
    return new Response(
      JSON.stringify({ error: e.message, results }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
