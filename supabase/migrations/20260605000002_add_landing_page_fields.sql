-- Add landing page fields to units table
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS parceria text;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS logo_parceiro_url text;

-- Add landing page fields to classes table
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS foto_professor_url text;

-- Populate default slugs for existing units
UPDATE unidades SET slug = 'bernoulli' WHERE nome = 'Colégio Bernoulli' AND slug IS NULL;
UPDATE unidades SET slug = 'dom_pedrinho' WHERE nome = 'Escola Dom Pedrinho' AND slug IS NULL;
UPDATE unidades SET slug = 'aka' WHERE nome = 'AKA Dojo' AND slug IS NULL;
UPDATE unidades SET slug = 'bunny' WHERE nome = 'Colégio Bunny' AND slug IS NULL;

-- Automatically generate slugs from name for any other units using regex
UPDATE unidades SET slug = lower(regexp_replace(nome, '[^a-zA-Z0-9]+', '_', 'g')) WHERE slug IS NULL;
