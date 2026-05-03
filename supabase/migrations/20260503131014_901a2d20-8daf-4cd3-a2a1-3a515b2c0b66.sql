
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- trips
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  date_label text,
  color text not null default '#533483',
  created_at timestamptz not null default now()
);
alter table public.trips enable row level security;
create policy "trips_select_own" on public.trips for select using (auth.uid() = user_id);
create policy "trips_insert_own" on public.trips for insert with check (auth.uid() = user_id);
create policy "trips_update_own" on public.trips for update using (auth.uid() = user_id);
create policy "trips_delete_own" on public.trips for delete using (auth.uid() = user_id);

-- trip_places
create table public.trip_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text,
  name text not null,
  sub text,
  created_at timestamptz not null default now()
);
alter table public.trip_places enable row level security;
create policy "trip_places_select_own" on public.trip_places for select using (auth.uid() = user_id);
create policy "trip_places_insert_own" on public.trip_places for insert with check (auth.uid() = user_id);
create policy "trip_places_update_own" on public.trip_places for update using (auth.uid() = user_id);
create policy "trip_places_delete_own" on public.trip_places for delete using (auth.uid() = user_id);

-- place_videos
create table public.place_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_place_id uuid references public.trip_places(id) on delete cascade,
  place_id text,
  place_name text,
  storage_path text not null,
  duration_ms int,
  created_at timestamptz not null default now()
);
alter table public.place_videos enable row level security;
create policy "place_videos_select_own" on public.place_videos for select using (auth.uid() = user_id);
create policy "place_videos_insert_own" on public.place_videos for insert with check (auth.uid() = user_id);
create policy "place_videos_update_own" on public.place_videos for update using (auth.uid() = user_id);
create policy "place_videos_delete_own" on public.place_videos for delete using (auth.uid() = user_id);

-- storage bucket
insert into storage.buckets (id, name, public) values ('videos', 'videos', false)
on conflict (id) do nothing;

create policy "videos_select_own" on storage.objects for select
  using (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "videos_insert_own" on storage.objects for insert
  with check (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "videos_update_own" on storage.objects for update
  using (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "videos_delete_own" on storage.objects for delete
  using (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);
