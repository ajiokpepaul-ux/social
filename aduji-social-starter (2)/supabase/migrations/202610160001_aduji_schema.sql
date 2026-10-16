-- ADUJI starter schema for Supabase PostgreSQL
-- Run in Supabase Dashboard -> SQL Editor.
-- Public client keys are expected in the browser; never put service_role keys here.

create extension if not exists pgcrypto;

create type public.video_visibility as enum ('public', 'unlisted', 'private');
create type public.engagement_event_type as enum (
  'view_start', 'view_3s', 'view_complete', 'replay', 'like', 'unlike',
  'share', 'save', 'comment', 'profile_visit', 'follow', 'skip', 'not_interested'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text,
  avatar_url text,
  bio text check (char_length(coalesce(bio, '')) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 2200),
  video_url text not null,
  thumbnail_url text,
  visibility public.video_visibility not null default 'public',
  duration_seconds numeric(8,2),
  created_at timestamptz not null default now()
);
create index if not exists videos_public_created_idx on public.videos (created_at desc) where visibility = 'public';
create index if not exists videos_user_created_idx on public.videos (user_id, created_at desc);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows (following_id);

create table if not exists public.video_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
create index if not exists video_likes_video_idx on public.video_likes (video_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  image_url text,
  gif_url text,
  created_at timestamptz not null default now(),
  check (char_length(trim(body)) > 0 or image_url is not null or gif_url is not null)
);
create index if not exists comments_video_created_idx on public.comments (video_id, created_at asc);

create table if not exists public.saved_videos (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists messages_pair_created_idx on public.messages (sender_id, recipient_id, created_at desc);
create index if not exists messages_recipient_created_idx on public.messages (recipient_id, created_at desc);

create table if not exists public.engagement_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  video_id uuid references public.videos(id) on delete cascade,
  event_type public.engagement_event_type not null,
  watch_ms integer check (watch_ms is null or watch_ms between 0 and 86400000),
  created_at timestamptz not null default now()
);
create index if not exists engagement_user_created_idx on public.engagement_events (user_id, created_at desc);
create index if not exists engagement_video_type_idx on public.engagement_events (video_id, event_type);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('video', 'comment', 'profile', 'message')),
  target_id text not null,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

-- Create a profile automatically after signup. A safe generated username can be changed later.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, 'user'), '@', 1)), '[^a-zA-Z0-9_]', '', 'g'));
  base_username := substring(base_username from 1 for 15);
  if length(base_username) < 3 then base_username := 'user'; end if;
  final_username := base_username || '_' || substring(replace(new.id::text, '-', '') from 1 for 6);

  insert into public.profiles (id, username, display_name)
  values (new.id, final_username, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper to make messages readable only to the sender or recipient.
create or replace function public.is_message_participant(message_sender uuid, message_recipient uuid)
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select auth.uid() = message_sender or auth.uid() = message_recipient
$$;

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.follows enable row level security;
alter table public.video_likes enable row level security;
alter table public.comments enable row level security;
alter table public.saved_videos enable row level security;
alter table public.messages enable row level security;
alter table public.engagement_events enable row level security;
alter table public.reports enable row level security;

-- Profiles: public read, self update only.
create policy "profiles are viewable by everyone" on public.profiles for select using (true);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Videos: public videos are discoverable; owner can see/manage own videos.
create policy "public and own videos readable" on public.videos for select
using (visibility = 'public' or user_id = auth.uid());
create policy "authenticated users create own videos" on public.videos for insert
to authenticated with check (user_id = auth.uid());
create policy "owners update own videos" on public.videos for update
to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners delete own videos" on public.videos for delete
to authenticated using (user_id = auth.uid());

create policy "follows readable" on public.follows for select using (true);
create policy "users follow as themselves" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "users unfollow as themselves" on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy "likes readable" on public.video_likes for select using (true);
create policy "users like as themselves" on public.video_likes for insert to authenticated with check (user_id = auth.uid());
create policy "users remove own likes" on public.video_likes for delete to authenticated using (user_id = auth.uid());

create policy "comments readable on visible videos" on public.comments for select using (
  exists (select 1 from public.videos v where v.id = video_id and (v.visibility = 'public' or v.user_id = auth.uid()))
);
create policy "authenticated users create own comments" on public.comments for insert to authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.videos v where v.id = video_id and v.visibility = 'public'
  )
);
create policy "authors update own comments" on public.comments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "authors delete own comments" on public.comments for delete to authenticated using (user_id = auth.uid());

create policy "users read own saved videos" on public.saved_videos for select to authenticated using (user_id = auth.uid());
create policy "users save videos as themselves" on public.saved_videos for insert to authenticated with check (user_id = auth.uid());
create policy "users unsave own videos" on public.saved_videos for delete to authenticated using (user_id = auth.uid());

create policy "participants read messages" on public.messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "sender creates own messages" on public.messages for insert to authenticated with check (sender_id = auth.uid());
create policy "recipient marks received messages read" on public.messages for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create policy "users insert own engagement events" on public.engagement_events for insert to authenticated with check (user_id = auth.uid() or user_id is null);
create policy "users read own engagement events" on public.engagement_events for select to authenticated using (user_id = auth.uid());

create policy "users submit own reports" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "reporters can view own reports" on public.reports for select to authenticated using (reporter_id = auth.uid());

-- Storage buckets for the starter. Public reads for public media; writes restricted to each user's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 52428800, array['video/mp4','video/webm','video/quicktime','video/x-m4v'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comment-media', 'comment-media', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "public can read public video files" on storage.objects for select using (bucket_id = 'videos');
create policy "users upload video files to own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own video files" on storage.objects for update to authenticated
using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own video files" on storage.objects for delete to authenticated
using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "public can read comment images" on storage.objects for select using (bucket_id = 'comment-media');
create policy "users upload comment images to own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'comment-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own comment images" on storage.objects for update to authenticated
using (bucket_id = 'comment-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'comment-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own comment images" on storage.objects for delete to authenticated
using (bucket_id = 'comment-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Basic feed score. This is a starter heuristic, not a trained ML model.
-- Scores public videos using recent engagement counts and freshness.
create or replace function public.get_recommended_videos(result_limit integer default 20)
returns table (
  id uuid, user_id uuid, caption text, video_url text, thumbnail_url text,
  visibility public.video_visibility, created_at timestamptz, recommendation_score double precision
)
language sql stable security invoker
set search_path = ''
as $$
  with candidates as (
    select v.*,
      (select count(*)::double precision from public.video_likes l where l.video_id = v.id) as likes,
      (select count(*)::double precision from public.comments c where c.video_id = v.id) as comments,
      greatest(0.0, 72.0 - extract(epoch from (now() - v.created_at))/3600.0) as freshness
    from public.videos v
    where v.visibility = 'public'
      and (auth.uid() is null or not exists (
        select 1 from public.engagement_events e
        where e.user_id = auth.uid() and e.video_id = v.id and e.event_type = 'not_interested'
      ))
  )
  select c.id, c.user_id, c.caption, c.video_url, c.thumbnail_url, c.visibility, c.created_at,
    (ln(1 + c.likes) * 1.4 + ln(1 + c.comments) * 1.8 + c.freshness * 0.08) as recommendation_score
  from candidates c
  order by recommendation_score desc, c.created_at desc
  limit greatest(1, least(coalesce(result_limit, 20), 100))
$$;

grant execute on function public.get_recommended_videos(integer) to anon, authenticated;
