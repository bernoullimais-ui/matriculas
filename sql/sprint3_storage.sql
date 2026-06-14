-- Create a new bucket for WhatsApp Media
insert into storage.buckets (id, name, public)
values ('whatsapp_media', 'whatsapp_media', true)
on conflict (id) do nothing;

-- Set up RLS policies for the bucket (allow anyone to read public files)
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'whatsapp_media' );

-- Allow authenticated users to upload
create policy "Admin Upload"
on storage.objects for insert
with check ( bucket_id = 'whatsapp_media' and auth.role() = 'authenticated' );

-- Allow authenticated users to delete (for cleanup)
create policy "Admin Delete"
on storage.objects for delete
using ( bucket_id = 'whatsapp_media' and auth.role() = 'authenticated' );
