-- Create website_configs Table
CREATE TABLE IF NOT EXISTS public.website_configs (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  banner_url text,
  banner_title text,
  banner_subtitle text,
  video_url text,
  differentials jsonb DEFAULT '[]'::jsonb,
  testimonials jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT website_configs_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.website_configs ENABLE ROW LEVEL SECURITY;

-- Allow public read
CREATE POLICY "Allow public read on website_configs"
ON public.website_configs FOR SELECT
TO public
USING (true);

-- Allow authenticated update
CREATE POLICY "Allow authenticated all on website_configs"
ON public.website_configs FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add status to leads if it doesn't exist
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'novo';
