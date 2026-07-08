-- Add unique constraint to pagamento_id to prevent duplicate NFe generation
-- on concurrent webhook events
ALTER TABLE public.notas_fiscais_fila
ADD CONSTRAINT notas_fiscais_fila_pagamento_id_key UNIQUE (pagamento_id);
