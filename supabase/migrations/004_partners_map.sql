-- Partner places (vets, pharmacies, stores...) pinned on the app map.
-- Stream inserts/updates/deletes to the app so new partners appear on the map right away.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'partners'
  ) then
    alter publication supabase_realtime add table public.partners;
  end if;
end $$;

notify pgrst, 'reload schema';
