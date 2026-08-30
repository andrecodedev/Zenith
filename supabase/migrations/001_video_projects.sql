create table if not exists video_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  schema_version int not null default 1,
  project_json jsonb not null,
  duration_sec numeric,
  thumbnail_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table video_projects enable row level security;

create policy "Users manage own video projects"
  on video_projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists video_projects_user_id_idx on video_projects (user_id);
create index if not exists video_projects_updated_at_idx on video_projects (updated_at desc);
