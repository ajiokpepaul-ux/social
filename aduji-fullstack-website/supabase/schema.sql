-- ADUJI Supabase schema
-- Run this entire file in Supabase Dashboard -> SQL Editor -> New query.
-- Then create a PUBLIC Storage bucket named post-media (or run the storage section below).
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text not null default 'Creator' check (char_length(display_name) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 1500),
  tags text[] not null default '{}',
  media_url text,
  media_type text not null default 'text' check (media_type in ('text','image','video')),
  visibility text not null default 'public' check (visibility in ('public','private')),
  created_at timestamptz not null default now()
);
create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create table if not exists public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_user_id_idx on public.posts(user_id);
create index if not exists comments_post_id_idx on public.comments(post_id, created_at);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists follows_following_idx on public.follows(following_id);

-- Create profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  base_name text;
  safe_name text;
begin
  base_name := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'creator');
  safe_name := regexp_replace(lower(base_name), '[^a-z0-9_]', '', 'g');
  if length(safe_name) < 3 then safe_name := 'creator_' || substr(new.id::text,1,6); end if;
  if length(safe_name) > 24 then safe_name := substr(safe_name,1,24); end if;
  insert into public.profiles(id, username, display_name)
  values(new.id, safe_name || '_' || substr(new.id::text,1,4), coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', 'Creator'))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Helper to check conversation membership without recursive RLS.
create or replace function public.is_conversation_member(cid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.conversation_participants cp where cp.conversation_id=cid and cp.user_id=auth.uid()); $$;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.saved_posts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Profiles: publicly readable; users update only their own profile.
drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable" on public.profiles for select using (true);
drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles for insert to authenticated with check (id=auth.uid());
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

-- Posts: public feed readable; only the author can create/update/delete their posts.
drop policy if exists "public can read public posts" on public.posts;
create policy "public can read public posts" on public.posts for select using (visibility='public' or user_id=auth.uid());
drop policy if exists "authors create posts" on public.posts;
create policy "authors create posts" on public.posts for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "authors update posts" on public.posts;
create policy "authors update posts" on public.posts for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "authors delete posts" on public.posts;
create policy "authors delete posts" on public.posts for delete to authenticated using (user_id=auth.uid());

-- Likes
drop policy if exists "likes visible to everyone" on public.likes;
create policy "likes visible to everyone" on public.likes for select using (true);
drop policy if exists "users like as themselves" on public.likes;
create policy "users like as themselves" on public.likes for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "users remove own likes" on public.likes;
create policy "users remove own likes" on public.likes for delete to authenticated using (user_id=auth.uid());

-- Comments
drop policy if exists "comments visible for public posts" on public.comments;
create policy "comments visible for public posts" on public.comments for select using (exists(select 1 from public.posts p where p.id=post_id and (p.visibility='public' or p.user_id=auth.uid())));
drop policy if exists "authenticated users comment as themselves" on public.comments;
create policy "authenticated users comment as themselves" on public.comments for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "users delete own comments" on public.comments;
create policy "users delete own comments" on public.comments for delete to authenticated using (user_id=auth.uid());

-- Follows
drop policy if exists "follows are publicly readable" on public.follows;
create policy "follows are publicly readable" on public.follows for select using (true);
drop policy if exists "users follow as themselves" on public.follows;
create policy "users follow as themselves" on public.follows for insert to authenticated with check (follower_id=auth.uid() and follower_id<>following_id);
drop policy if exists "users unfollow as themselves" on public.follows;
create policy "users unfollow as themselves" on public.follows for delete to authenticated using (follower_id=auth.uid());

-- Saved posts: private to the owner.
drop policy if exists "users read own saved posts" on public.saved_posts;
create policy "users read own saved posts" on public.saved_posts for select to authenticated using (user_id=auth.uid());
drop policy if exists "users save own posts" on public.saved_posts;
create policy "users save own posts" on public.saved_posts for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "users unsave own posts" on public.saved_posts;
create policy "users unsave own posts" on public.saved_posts for delete to authenticated using (user_id=auth.uid());

-- Conversations and private messages: only participants can read.
drop policy if exists "participants read conversations" on public.conversations;
create policy "participants read conversations" on public.conversations for select to authenticated using (public.is_conversation_member(id));
drop policy if exists "signed in users create conversations" on public.conversations;
create policy "signed in users create conversations" on public.conversations for insert to authenticated with check (created_by=auth.uid());
drop policy if exists "participants read participants" on public.conversation_participants;
create policy "participants read participants" on public.conversation_participants for select to authenticated using (public.is_conversation_member(conversation_id));
drop policy if exists "conversation creator adds participants" on public.conversation_participants;
create policy "conversation creator adds participants" on public.conversation_participants for insert to authenticated with check (
  user_id=auth.uid() or exists(select 1 from public.conversations c where c.id=conversation_id and c.created_by=auth.uid())
);
drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));
drop policy if exists "participants send messages as themselves" on public.messages;
create policy "participants send messages as themselves" on public.messages for insert to authenticated with check (sender_id=auth.uid() and public.is_conversation_member(conversation_id));

-- Public media bucket. In production, review quotas, file size and content type restrictions.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media','post-media',true,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public=true, file_size_limit=52428800, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "public can view post media" on storage.objects;
create policy "public can view post media" on storage.objects for select using (bucket_id='post-media');
drop policy if exists "authenticated users upload own media" on storage.objects;
create policy "authenticated users upload own media" on storage.objects for insert to authenticated with check (bucket_id='post-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "users update own media" on storage.objects;
create policy "users update own media" on storage.objects for update to authenticated using (bucket_id='post-media' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='post-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "users delete own media" on storage.objects;
create policy "users delete own media" on storage.objects for delete to authenticated using (bucket_id='post-media' and (storage.foldername(name))[1]=auth.uid()::text);
