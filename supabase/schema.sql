-- Pegá esto en Supabase → SQL Editor → Run

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  game_name text not null,
  tag_line text not null,
  puuid text unique,
  main_role text not null check (main_role in ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')),
  alt_role  text not null check (alt_role  in ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')),
  peak_tier text,          -- IRON ... CHALLENGER (rango histórico máximo, lo carga el jugador)
  peak_division text,      -- I, II, III, IV (null para Master+)
  active boolean not null default true,   -- si participa del armado de equipos
  manual_adjust int not null default 0,   -- ajuste a mano del admin (ej: smurfs)
  solo_tier text, solo_division text, solo_lp int, solo_wins int, solo_losses int,
  flex_tier text, flex_division text, flex_lp int, flex_wins int, flex_losses int,
  last_synced_at timestamptz,
  sync_error text,
  created_at timestamptz not null default now()
);

create unique index if not exists players_riot_id_idx on players (lower(game_name), lower(tag_line));

create table if not exists player_matches (
  match_id text not null,
  puuid text not null,
  queue_id int,
  champion text,
  position text,
  win boolean,
  kills int, deaths int, assists int,
  cs int,           -- minions + monstruos
  damage int,       -- daño a campeones
  gold int,
  vision int,
  team_kills int,
  duration_s int,
  game_end timestamptz,
  primary key (match_id, puuid)
);

create index if not exists player_matches_puuid_idx on player_matches (puuid, game_end desc);

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  published boolean not null default false,
  data jsonb not null
);

-- RLS activado y sin políticas: nadie puede leer/escribir desde el navegador con la anon key.
-- La app accede solo desde el servidor con la service_role key.
alter table players enable row level security;
alter table player_matches enable row level security;
alter table drafts enable row level security;
