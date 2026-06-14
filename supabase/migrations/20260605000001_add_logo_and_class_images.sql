-- Add logo_url and imagem_url to unidades table for branding and banners
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS imagem_url text;

-- Add imagem_url to turmas table for illustrative/characterizing images
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS imagem_url text;
