-- Create professores table
CREATE TABLE IF NOT EXISTS professores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  foto_url text,
  bio text,
  created_at timestamptz DEFAULT now()
);

-- Create parceiros table
CREATE TABLE IF NOT EXISTS parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  logo_url text,
  created_at timestamptz DEFAULT now()
);

-- Add optional foreign keys to turmas and unidades
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS professor_id uuid REFERENCES professores(id) ON DELETE SET NULL;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS parceiro_id uuid REFERENCES parceiros(id) ON DELETE SET NULL;

-- Automatically migrate and back-populate existing teachers from turmas
INSERT INTO professores (nome, foto_url)
SELECT DISTINCT professor, foto_professor_url
FROM turmas
WHERE professor IS NOT NULL AND professor != ''
ON CONFLICT (nome) DO NOTHING;

-- Link existing turmas to created teachers
UPDATE turmas t
SET professor_id = p.id
FROM professores p
WHERE t.professor = p.nome;

-- Automatically migrate and back-populate existing partners from unidades
INSERT INTO parceiros (nome, logo_url)
SELECT DISTINCT parceria, logo_parceiro_url
FROM unidades
WHERE parceria IS NOT NULL AND parceria != ''
ON CONFLICT (nome) DO NOTHING;

-- Link existing unidades to created partners
UPDATE unidades u
SET parceiro_id = p.id
FROM parceiros p
WHERE u.parceria = p.nome;

-- Disable Row Level Security (RLS) to match other public option tables
ALTER TABLE professores DISABLE ROW LEVEL SECURITY;
ALTER TABLE parceiros DISABLE ROW LEVEL SECURITY;
