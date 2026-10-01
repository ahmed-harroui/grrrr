-- Trending profiles = the pets with the most XP. Index so the ranking stays fast. Safe to run again.
create index if not exists pets_xp_rank_idx on public.pets (xp desc, level desc);

-- Result shown in the SQL Editor: the current top 10.
select pet_name, species, xp, level, is_bot from public.pets order by xp desc, level desc limit 10;
