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
-- Chequeos de filtraciones — cada correo/teléfono consultado
-- ============================================================
create table if not exists public.breach_checks (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,                  -- 'email' | 'phone'
  value         text not null,                  -- valor consultado (en claro)
  domain        text,                           -- dominio del correo o código de país del tel
  found         boolean not null default false, -- ¿apareció en alguna filtración?
  breach_count  int not null default 0,         -- nº de filtraciones encontradas
  source        text,                           -- 'web' | 'bot'
  user_jid      text,                           -- JID de WhatsApp si vino del bot
  created_at    timestamptz not null default now()
);

create index if not exists idx_breach_kind   on public.breach_checks(kind, created_at desc);
create index if not exists idx_breach_found  on public.breach_checks(found, created_at desc);
create index if not exists idx_breach_domain on public.breach_checks(domain);

-- ============================================================
-- Mapeo LID → teléfono real
-- WhatsApp moderno entrega el remitente como @lid (identidad opaca) y solo
-- revela el teléfono (sender_pn) en algunos mensajes. Aquí acumulamos el
-- mapeo cada vez que aparece, para des-anonimizar los @lid históricos.
-- ============================================================
create table if not exists public.lid_map (
  lid         text primary key,               -- 1234567890@lid
  phone_jid   text,                            -- 521614...@s.whatsapp.net
  phone       text,                            -- +521614... (solo dígitos con +)
  pushname    text,                            -- nombre visible en WhatsApp
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create index if not exists idx_lid_map_phone on public.lid_map(phone);

-- ============================================================
-- Crowdsourcing de fraudes — base compartida que mejora con cada reporte
-- Cada detección "rojo" con indicador claro (dominio/url/teléfono) suma aquí;
-- cuando alguien vuelve a verlo, avisamos "N personas ya lo reportaron".
-- ============================================================
create table if not exists public.known_frauds (
  indicator   text primary key,         -- dominio, url o teléfono normalizado
  kind        text not null,            -- 'domain' | 'url' | 'phone'
  hits        int  not null default 1,  -- cuántas veces se ha reportado/visto
  risk        text,                     -- último nivel de riesgo asociado
  category    text,                     -- categoría del fraude
  sample      text,                     -- ejemplo del contenido (truncado)
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create index if not exists idx_known_frauds_kind on public.known_frauds(kind, hits desc);

-- ============================================================
-- RLS — permisivo para el hackathon (frontend lee con publishable key)
-- El service_role / sb_secret SIEMPRE bypassa RLS, así que el backend
-- puede escribir libremente sin policies de insert/update.
-- ============================================================
alter table public.pymes enable row level security;
alter table public.scans enable row level security;
alter table public.phishing_detections enable row level security;
alter table public.breach_checks enable row level security;
-- lid_map: SIN lectura pública. Contiene teléfonos en claro (PII).
-- Solo el backend (service_role) la lee/escribe; bypassa RLS.
alter table public.lid_map enable row level security;
-- known_frauds: SIN lectura pública (puede contener teléfonos). Solo backend.
alter table public.known_frauds enable row level security;

-- Lectura pública (demo)
-- pymes y phishing_detections: SIN lectura pública. Contienen PII
-- (owner_email, owner_jid, user_jid/teléfono, pushname, raw_content). El
-- frontend las lee server-side con service_role (lib/supabase-admin.ts).
-- Cerrado tras auditoría de seguridad (C1 fuga de PII / A4).
drop policy if exists "public read pymes" on public.pymes;
drop policy if exists "public read phishing" on public.phishing_detections;

-- scans no tiene PII personal (hallazgos técnicos del sitio) → lectura pública OK.
drop policy if exists "public read scans" on public.scans;
create policy "public read scans" on public.scans
  for select using (true);

-- breach_checks: SIN lectura pública. Contiene PII en claro (correos/teléfonos).
-- Solo el backend (service_role) puede leer/escribir; bypassa RLS.
-- No se crea ninguna policy de select → la anon key no puede leerla.

-- ============================================================
-- Vista útil para el dashboard
-- ============================================================
-- security_invoker: la vista respeta las RLS policies del que consulta (no
-- las del owner), para que no filtre pymes con la anon key (A4).
create or replace view public.pyme_overview with (security_invoker = on) as
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

-- ============================================================
-- Visitas a /ip — IP pública + geolocalización + reputación
-- Registra a quienes entran a sabuezo.com/ip. Contiene PII (IPs) →
-- RLS habilitado SIN lectura pública. Solo el servidor (service_role) escribe.
-- ============================================================
create table if not exists public.ip_visits (
  id           uuid primary key default gen_random_uuid(),
  ip           text,
  country      text,
  region       text,
  city         text,
  latitude     double precision,
  longitude    double precision,
  isp          text,
  is_proxy     boolean,                          -- VPN / proxy / Tor (ip-api)
  is_hosting   boolean,                          -- datacenter / hosting (ip-api)
  is_mobile    boolean,
  abuse_score  int,                              -- AbuseIPDB 0-100 (null sin key)
  leak_found   boolean,                          -- reservado
  user_agent   text,
  referer      text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_ip_visits_created on public.ip_visits(created_at desc);
create index if not exists idx_ip_visits_ip on public.ip_visits(ip, created_at desc);

alter table public.ip_visits enable row level security;
-- Sin policy de select → la anon key no puede leer las IPs de los visitantes.
