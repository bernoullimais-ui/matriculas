-- Create Leads Table
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  nome text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leads_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (anyone can submit the form)
CREATE POLICY "Allow public insert on leads"
ON public.leads FOR INSERT
TO public
WITH CHECK (true);

-- Allow read for authenticated users (admin panel)
CREATE POLICY "Allow authenticated read on leads"
ON public.leads FOR SELECT
TO authenticated
USING (true);
