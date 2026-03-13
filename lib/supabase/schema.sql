-- GRIMOIRE INTELLIGENCE — Supabase Schema
-- Run in: Supabase Dashboard → SQL Editor → Run

create table if not exists profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text,
  created_at  timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users see own profile" on profiles for all using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists rituals (
  id                 uuid default gen_random_uuid() primary key,
  user_id            uuid references auth.users on delete cascade not null,
  title              text not null,
  intent_type        text,
  date               date,
  moon_phase         text,
  planet_day         text,
  ingredients        text[] default '{}',
  tools              text[] default '{}',
  duration           integer,
  success_rating     integer check (success_rating between 0 and 5),
  outcome_flag       text,
  manifestation_date date,
  outcome            text,
  energy_conditions  text,
  version            integer default 1,
  parent_id          uuid references rituals(id),
  created_at         timestamptz default now()
);
alter table rituals enable row level security;
create policy "Users manage own rituals" on rituals for all using (auth.uid() = user_id);
create index rituals_user_id_idx on rituals(user_id);
create index rituals_date_idx on rituals(date desc);

create table if not exists tarot_logs (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  date        date,
  spread      text,
  moon_phase  text,
  question    text,
  cards       text[] default '{}',
  notes       text,
  ai_reading  text,
  created_at  timestamptz default now()
);
alter table tarot_logs enable row level security;
create policy "Users manage own tarot logs" on tarot_logs for all using (auth.uid() = user_id);
create index tarot_logs_user_id_idx on tarot_logs(user_id);

create table if not exists sigils (
  id                  uuid default gen_random_uuid() primary key,
  user_id             uuid references auth.users on delete cascade not null,
  name                text not null,
  intent              text,
  symbol              text,
  color               text default '#c8a84a',
  activation_date     date,
  recharge_date       date,
  manifestation_date  date,
  status              text default 'active',
  notes               text,
  created_at          timestamptz default now()
);
alter table sigils enable row level security;
create policy "Users manage own sigils" on sigils for all using (auth.uid() = user_id);
create index sigils_user_id_idx on sigils(user_id);
