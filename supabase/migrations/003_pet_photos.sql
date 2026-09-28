-- Pet photo gallery: photo_url stays the avatar, photos holds the extra pictures.
alter table public.pets add column if not exists photos text[] not null default '{}';

-- Public bucket so every user can see pet pictures; files live under <owner_id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pet-photos', 'pet-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = true;

drop policy if exists "Pet photos are publicly readable" on storage.objects;
create policy "Pet photos are publicly readable" on storage.objects
  for select using (bucket_id = 'pet-photos');

drop policy if exists "Owners can upload pet photos" on storage.objects;
create policy "Owners can upload pet photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners can update pet photos" on storage.objects;
create policy "Owners can update pet photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners can delete pet photos" on storage.objects;
create policy "Owners can delete pet photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Make the API (PostgREST) see the new column right away.
notify pgrst, 'reload schema';
