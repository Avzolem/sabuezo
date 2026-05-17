-- ============================================================
-- Sabuezo — schema inicial
-- Pega esto completo en Supabase → SQL Editor → New query → Run
-- ============================================================

-- Asegúrate de tener pgcrypto para gen_random_uuid()
create extension if not exists "pgcrypto";

-- ============================================================
-- PyMEs registradas
-- ============================================================
create table if not exists public.pymes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  website       text not null,
  owner_email   text,
  owner_jid     text unique,                          -- WhatsApp JID del dueño
  pushname      text,                                  -- nombre que muestra WhatsApp
  created_at    timestamptz not null default now(),
  last_scan_at  timestamptz,
  last_score    int
);

create index if not exists idx_pymes_owner_jid on public.pymes(owner_jid);
create index if not exists idx_pymes_website   on public.pymes(website);

-- ============================================================
-- Scans del sitio web
-- ============================================================
create table if not exists public.scans (
  id          uuid primary key default gen_random_uuid(),
  pyme_id     uuid references public.pymes(id) on delete cascade,
  url         text not null,
  domain      text,
  score       int  not null,
  summary     text,
  findings    jsonb not null,
  raw         jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_scans_pyme_id on public.scans(pyme_id, created_at desc);
create index if not exists idx_scans_created on public.scans(created_at desc);

-- ============================================================
-- Detecciones de phishing — cada mensaje analizado
-- ============================================================
create table if not exists public.phishing_detections (
  id                  uuid primary key default gen_random_uuid(),
  pyme_id             uuid references public.pymes(id) on delete set null,
  user_jid            text,
  pushname            text,
  kind                text not null,                  -- 'text' | 'image' | 'url'
  risk                text not null,                  -- 'rojo' | 'amarillo' | 'verde'
  confidence          int,
  category            text,
  red_flags           jsonb,
  explanation         text,
  recommended_action  text,
  raw_content         text,                            -- mensaje original (truncado a 2000)
  metadata            jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists idx_phishing_pyme on public.phishing_detections(pyme_id, created_at desc);
create index if not exists idx_phishing_user on public.phishing_detections(user_jid, created_at desc);
create index if not exists idx_phishing_risk on public.phishing_detections(risk, created_at desc);

-- ============================================================
-- RLS — permisivo para el hackathon (frontend lee con publishable key)
-- El service_role / sb_secret SIEMPRE bypassa RLS, así que el backend
-- puede escribir libremente sin policies de insert/update.
-- ============================================================
alter table public.pymes enable row level security;
alter table public.scans enable row level security;
alter table public.phishing_detections enable row level security;

-- Lectura pública (demo)
drop policy if exists "public read pymes" on public.pymes;
create policy "public read pymes" on public.pymes
  for select using (true);

drop policy if exists "public read scans" on public.scans;
create policy "public read scans" on public.scans
  for select using (true);

drop policy if exists "public read phishing" on public.phishing_detections;
create policy "public read phishing" on public.phishing_detections
  for select using (true);

-- ============================================================
-- Vista útil para el dashboard
-- ============================================================
create or replace view public.pyme_overview as
select
  p.id,
  p.name,
  p.website,
  p.owner_email,
  p.pushname,
  p.created_at,
  p.last_scan_at,
  p.last_score,
  (select count(*) from public.phishing_detections d
     where d.pyme_id = p.id and d.risk = 'rojo') as red_count,
  (select count(*) from public.phishing_detections d
     where d.pyme_id = p.id and d.risk = 'amarillo') as yellow_count,
  (select count(*) from public.phishing_detections d
     where d.pyme_id = p.id) as total_detections
from public.pymes p;
