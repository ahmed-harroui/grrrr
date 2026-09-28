-- GRRR Care Knowledge Base Schema
-- Phase 2: Knowledge Engine with pgvector support

-- Enable pgvector extension
create extension if not exists vector;

-- Knowledge Sources Table
create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  url text,
  authority_level text check (authority_level in ('primary', 'secondary', 'reference')),
  organization text,
  verified_date date,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(name)
);

-- Knowledge Documents Table
create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  species text[] default '{}',
  tags text[] default '{}',
  risk_level text check (risk_level in ('low', 'moderate', 'high', 'emergency')),
  source_id uuid references public.knowledge_sources(id) on delete set null,
  content text,
  reviewed_by text,
  review_date date,
  is_published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Knowledge Chunks Table (for RAG/vector search)
create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_text text not null,
  chunk_index integer not null,
  embedding vector(1536),
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Emergency Guides Table
create table if not exists public.emergency_guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  emergency_type text not null,
  species text[] default '{}',
  description text,
  symptoms text[],
  immediate_actions text[],
  when_to_call_vet text,
  risk_level text default 'emergency',
  source_id uuid references public.knowledge_sources(id) on delete set null,
  is_published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for vector search
create index if not exists knowledge_chunks_embedding_idx on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index if not exists knowledge_documents_species_idx on public.knowledge_documents
  using gin (species);

create index if not exists knowledge_documents_tags_idx on public.knowledge_documents
  using gin (tags);

create index if not exists knowledge_documents_risk_level_idx on public.knowledge_documents (risk_level);

create index if not exists emergency_guides_species_idx on public.emergency_guides
  using gin (species);

-- Row Level Security
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.emergency_guides enable row level security;

-- Anyone can read knowledge base (public health information)
create policy "Knowledge sources are public" on public.knowledge_sources
  for select using (true);

create policy "Knowledge documents are public" on public.knowledge_documents
  for select using (true);

create policy "Knowledge chunks are public" on public.knowledge_chunks
  for select using (true);

create policy "Emergency guides are public" on public.emergency_guides
  for select using (true);

-- Only admins can write (manage through admin panel)
create policy "Only admins can update knowledge sources" on public.knowledge_sources
  for update using (auth.jwt() ->> 'role' = 'admin');

create policy "Only admins can insert knowledge sources" on public.knowledge_sources
  for insert with check (auth.jwt() ->> 'role' = 'admin');

create policy "Only admins can update knowledge documents" on public.knowledge_documents
  for update using (auth.jwt() ->> 'role' = 'admin');

create policy "Only admins can insert knowledge documents" on public.knowledge_documents
  for insert with check (auth.jwt() ->> 'role' = 'admin');

-- Create function to update updated_at timestamps
create or replace function public.update_knowledge_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger knowledge_sources_updated_at before update on public.knowledge_sources
  for each row execute function public.update_knowledge_updated_at();

create trigger knowledge_documents_updated_at before update on public.knowledge_documents
  for each row execute function public.update_knowledge_updated_at();

create trigger knowledge_chunks_updated_at before update on public.knowledge_chunks
  for each row execute function public.update_knowledge_updated_at();

create trigger emergency_guides_updated_at before update on public.emergency_guides
  for each row execute function public.update_knowledge_updated_at();

-- Create a view for common queries
create or replace view public.knowledge_by_species as
select
  d.id,
  d.title,
  d.category,
  d.species,
  d.risk_level,
  d.content,
  s.name as source_name,
  array_agg(distinct k.chunk_text) as chunks
from public.knowledge_documents d
left join public.knowledge_sources s on d.source_id = s.id
left join public.knowledge_chunks k on d.id = k.document_id
where d.is_published = true
group by d.id, s.name;

-- Create function for similarity search
create or replace function public.search_knowledge(query_embedding vector, match_threshold float, match_count int)
returns table(
  id uuid,
  chunk_text text,
  similarity float,
  document_id uuid,
  document_title text,
  risk_level text
) language sql stable as $$
  select
    kc.id,
    kc.chunk_text,
    1 - (kc.embedding <=> query_embedding) as similarity,
    kd.id,
    kd.title,
    kd.risk_level
  from public.knowledge_chunks kc
  join public.knowledge_documents kd on kc.document_id = kd.id
  where 1 - (kc.embedding <=> query_embedding) > match_threshold
  and kd.is_published = true
  order by similarity desc
  limit match_count;
$$;
