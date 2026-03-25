create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nickname text not null,
  quota_total integer not null default 5,
  quota_used integer not null default 0,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_profiles_nickname_unique_idx on public.user_profiles(nickname);

create or replace function public.is_admin_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_profiles up
    where up.id = uid
      and up.is_admin = true
  );
$$;

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material text not null,
  pattern text not null,
  product_type text not null,
  budget integer not null,
  subject text not null,
  title text not null,
  inspiration text not null,
  meaning text not null,
  grade text not null,
  image_url text not null,
  created_at timestamptz not null default now()
);

alter table public.works add column if not exists grade_score integer;
alter table public.works add column if not exists grade_reason text;

create index if not exists works_user_created_idx on public.works(user_id, created_at desc);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, work_id)
);

create index if not exists favorites_user_created_idx on public.favorites(user_id, created_at desc);

create table if not exists public.recharge_packages (
  id text primary key,
  name text not null,
  amount numeric(10,2) not null,
  times integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text references public.recharge_packages(id) on delete set null,
  amount numeric(10,2) not null,
  times integer not null,
  pay_channel text not null,
  status text not null default 'paid',
  third_party_order_no text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);

create table if not exists public.quota_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  applicant_name text,
  apply_reason text,
  requested_times integer not null check (requested_times > 0 and requested_times <= 10000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quota_applications add column if not exists applicant_name text;
alter table public.quota_applications add column if not exists apply_reason text;

create index if not exists quota_applications_user_created_idx on public.quota_applications(user_id, created_at desc);
create index if not exists quota_applications_status_created_idx on public.quota_applications(status, created_at desc);

alter table public.quota_applications drop constraint if exists quota_applications_requested_times_check;
alter table public.quota_applications add constraint quota_applications_requested_times_check check (requested_times > 0 and requested_times <= 10000);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  kind text not null default 'normal' check (kind in ('normal', 'announcement', 'activity')),
  reward_times integer not null default 0 check (reward_times >= 0 and reward_times <= 10000),
  target_user_id uuid references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.notices add column if not exists kind text not null default 'normal';
alter table public.notices add column if not exists reward_times integer not null default 0;
alter table public.notices add column if not exists target_user_id uuid references auth.users(id) on delete cascade;
alter table public.notices drop constraint if exists notices_kind_check;
alter table public.notices add constraint notices_kind_check check (kind in ('normal', 'announcement', 'activity'));
alter table public.notices drop constraint if exists notices_reward_times_check;
alter table public.notices add constraint notices_reward_times_check check (reward_times >= 0 and reward_times <= 10000);

create index if not exists notices_active_created_idx on public.notices(active, created_at desc);
create index if not exists notices_target_user_created_idx on public.notices(target_user_id, created_at desc);

create table if not exists public.message_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_type text not null check (message_type in ('notice', 'application')),
  message_id uuid not null,
  read_at timestamptz not null default now(),
  unique(user_id, message_type, message_id)
);

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notice_id uuid not null references public.notices(id) on delete cascade,
  reward_times integer not null check (reward_times > 0),
  claimed_at timestamptz not null default now(),
  unique(user_id, notice_id)
);

create index if not exists message_reads_user_read_idx on public.message_reads(user_id, read_at desc);
create index if not exists reward_claims_user_claimed_idx on public.reward_claims(user_id, claimed_at desc);

create table if not exists public.museum_items (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'natural' check (category in ('natural', 'carving')),
  title text not null,
  description text not null,
  image_url text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.museum_items add column if not exists category text not null default 'natural';
alter table public.museum_items drop constraint if exists museum_items_category_check;
alter table public.museum_items add constraint museum_items_category_check check (category in ('natural', 'carving'));

create index if not exists museum_items_active_created_idx on public.museum_items(active, created_at desc);

insert into storage.buckets (id, name, public)
values ('museum-assets', 'museum-assets', true)
on conflict (id) do update set public = true;

insert into public.recharge_packages(id, name, amount, times, active)
values
('pkg_9_9', '9.9 元 / 100次', 9.9, 100, true),
('pkg_19_9', '19.9 元 / 300次', 19.9, 300, true),
('pkg_39_9', '39.9 元 / 1000次', 39.9, 1000, true)
on conflict (id) do update set
  name = excluded.name,
  amount = excluded.amount,
  times = excluded.times,
  active = excluded.active,
  updated_at = now();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nickname_value text;
  admin_email constant text := '3492675568@qq.com';
begin
  nickname_value := coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1));

  insert into public.user_profiles(id, email, nickname, quota_total, quota_used, is_admin)
  values (
    new.id,
    new.email,
    nickname_value,
    case when lower(new.email) = admin_email then 2147483647 else 5 end,
    0,
    lower(new.email) = admin_email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

alter table public.user_profiles enable row level security;
alter table public.works enable row level security;
alter table public.favorites enable row level security;
alter table public.recharge_packages enable row level security;
alter table public.orders enable row level security;
alter table public.quota_applications enable row level security;
alter table public.notices enable row level security;
alter table public.message_reads enable row level security;
alter table public.reward_claims enable row level security;
alter table public.museum_items enable row level security;

drop policy if exists "profiles_select_own" on public.user_profiles;
create policy "profiles_select_own" on public.user_profiles
for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.user_profiles;
create policy "profiles_update_own" on public.user_profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "works_select_own" on public.works;
create policy "works_select_own" on public.works
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "works_insert_own" on public.works;
create policy "works_insert_own" on public.works
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "works_delete_own" on public.works;
create policy "works_delete_own" on public.works
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own" on public.favorites
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own" on public.favorites
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own" on public.favorites
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "packages_read_all" on public.recharge_packages;
create policy "packages_read_all" on public.recharge_packages
for select to authenticated using (active = true);

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "quota_apps_select_own" on public.quota_applications;
create policy "quota_apps_select_own" on public.quota_applications
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "quota_apps_insert_own" on public.quota_applications;
create policy "quota_apps_insert_own" on public.quota_applications
for insert to authenticated with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "quota_apps_select_admin" on public.quota_applications;
create policy "quota_apps_select_admin" on public.quota_applications
for select to authenticated using (public.is_admin_user(auth.uid()));

drop policy if exists "quota_apps_update_admin" on public.quota_applications;
create policy "quota_apps_update_admin" on public.quota_applications
for update to authenticated using (public.is_admin_user(auth.uid())) with check (public.is_admin_user(auth.uid()));

drop policy if exists "notices_select_active" on public.notices;
create policy "notices_select_active" on public.notices
for select to authenticated using (
  public.is_admin_user(auth.uid())
  or (active = true and (target_user_id is null or target_user_id = auth.uid()))
);

drop policy if exists "notices_insert_admin" on public.notices;
create policy "notices_insert_admin" on public.notices
for insert to authenticated with check (public.is_admin_user(auth.uid()));

drop policy if exists "notices_update_admin" on public.notices;
create policy "notices_update_admin" on public.notices
for update to authenticated using (public.is_admin_user(auth.uid())) with check (public.is_admin_user(auth.uid()));

drop policy if exists "notices_delete_admin" on public.notices;
create policy "notices_delete_admin" on public.notices
for delete to authenticated using (public.is_admin_user(auth.uid()));

drop policy if exists "message_reads_select_own" on public.message_reads;
create policy "message_reads_select_own" on public.message_reads
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "message_reads_insert_own" on public.message_reads;
create policy "message_reads_insert_own" on public.message_reads
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "message_reads_update_own" on public.message_reads;
create policy "message_reads_update_own" on public.message_reads
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reward_claims_select_own" on public.reward_claims;
create policy "reward_claims_select_own" on public.reward_claims
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "reward_claims_insert_own" on public.reward_claims;
create policy "reward_claims_insert_own" on public.reward_claims
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "museum_select_active" on public.museum_items;
create policy "museum_select_active" on public.museum_items
for select to authenticated using (active = true or public.is_admin_user(auth.uid()));

drop policy if exists "museum_insert_admin" on public.museum_items;
create policy "museum_insert_admin" on public.museum_items
for insert to authenticated with check (public.is_admin_user(auth.uid()));

drop policy if exists "museum_update_admin" on public.museum_items;
create policy "museum_update_admin" on public.museum_items
for update to authenticated using (public.is_admin_user(auth.uid())) with check (public.is_admin_user(auth.uid()));

drop policy if exists "museum_delete_admin" on public.museum_items;
create policy "museum_delete_admin" on public.museum_items
for delete to authenticated using (public.is_admin_user(auth.uid()));

drop policy if exists "museum_storage_public_read" on storage.objects;
create policy "museum_storage_public_read" on storage.objects
for select to public using (bucket_id = 'museum-assets');

drop policy if exists "museum_storage_admin_insert" on storage.objects;
create policy "museum_storage_admin_insert" on storage.objects
for insert to authenticated with check (bucket_id = 'museum-assets' and public.is_admin_user(auth.uid()));

drop policy if exists "museum_storage_admin_update" on storage.objects;
create policy "museum_storage_admin_update" on storage.objects
for update to authenticated using (bucket_id = 'museum-assets' and public.is_admin_user(auth.uid())) with check (bucket_id = 'museum-assets' and public.is_admin_user(auth.uid()));

drop policy if exists "museum_storage_admin_delete" on storage.objects;
create policy "museum_storage_admin_delete" on storage.objects
for delete to authenticated using (bucket_id = 'museum-assets' and public.is_admin_user(auth.uid()));
