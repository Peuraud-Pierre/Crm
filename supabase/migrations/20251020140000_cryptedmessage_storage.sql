-- Encrypted message storage bucket + policies

-- Create bucket (if not exists)
insert into storage.buckets (id, name, public)
values ('cryptedmessage', 'cryptedmessage', false)
on conflict (id) do nothing;

-- Policies for storage.objects

-- Allow authenticated users to upload to their chat paths
create policy "cryptedmessage uploads"
    on storage.objects
    for insert
    with check (
        bucket_id = 'cryptedmessage'
        and auth.uid() is not null
    );

-- Allow authenticated users to read encrypted blobs
create policy "cryptedmessage downloads"
    on storage.objects
    for select
    using (
        bucket_id = 'cryptedmessage'
        and auth.uid() is not null
    );

-- Allow delete for authenticated users (optional cleanup)
create policy "cryptedmessage deletes"
    on storage.objects
    for delete
    using (
        bucket_id = 'cryptedmessage'
        and auth.uid() is not null
    );
