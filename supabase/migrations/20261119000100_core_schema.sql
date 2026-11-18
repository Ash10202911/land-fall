-- Southbound core schema: tables, helper functions, Row Level Security.
-- Money is integer minor units (cents) with a 3-letter currency code. Timestamps are UTC.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  country     text not null check (char_length(btrim(country)) between 2 and 80),
  role        text not null check (role in ('agent', 'forwarder')),
  trust_level text not null default 'basic' check (trust_level in ('basic', 'verified')),
  status      text not null default 'active' check (status in ('active', 'suspended')),
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id),
  full_name  text not null default '' check (char_length(full_name) <= 120),
  email      text not null,
  phone      text check (phone is null or char_length(phone) <= 40),
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);
create index profiles_company_id_idx on public.profiles (company_id);

create table public.ports (
  id      serial primary key,
  code    text not null unique,
  name    text not null,
  country text not null
);

create table public.jobs (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id),
  created_by          uuid not null references public.profiles (id),
  direction           text not null check (direction in ('import', 'export')),
  incoterm            text not null check (incoterm in
                        ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP')),
  mode                text not null check (mode in ('FCL', 'LCL', 'Air')),
  origin_port_id      integer not null references public.ports (id),
  destination_port_id integer not null references public.ports (id),
  container_type      text check (container_type in ('20GP', '40GP', '40HC', '20RF', '40RF')),
  container_qty       integer check (container_qty between 1 and 999),
  weight_kg           numeric(12, 2) check (weight_kg > 0),
  volume_cbm          numeric(12, 3) check (volume_cbm > 0),
  cargo_description   text not null check (char_length(btrim(cargo_description)) between 2 and 1000),
  ready_date          date not null,
  services            text[] not null default '{}'
                        check (services <@ array['destination_charges', 'customs_clearance', 'delivery']::text[]),
  flag_dg             boolean not null default false,
  flag_reefer         boolean not null default false,
  flag_bmsb           boolean not null default false,
  deadline_at         timestamptz not null,
  notes               text check (notes is null or char_length(notes) <= 2000),
  status              text not null default 'open' check (status in ('open', 'awarded', 'cancelled')),
  awarded_quote_id    uuid,
  created_at          timestamptz not null default now(),
  constraint jobs_ports_differ check (origin_port_id <> destination_port_id),
  constraint jobs_fcl_needs_containers check (
    mode <> 'FCL' or (container_type is not null and container_qty is not null)
  ),
  constraint jobs_loose_cargo_needs_size check (
    mode = 'FCL' or (weight_kg is not null and volume_cbm is not null)
  )
);
create index jobs_company_id_idx on public.jobs (company_id);
create index jobs_feed_idx on public.jobs (status, created_at desc);
create index jobs_destination_idx on public.jobs (destination_port_id);

create table public.quotes (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  company_id  uuid not null references public.companies (id),
  created_by  uuid not null references public.profiles (id),
  valid_until date not null,
  notes       text check (notes is null or char_length(notes) <= 2000),
  status      text not null default 'sent' check (status in ('sent', 'withdrawn', 'won', 'lost')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index quotes_job_id_idx on public.quotes (job_id);
create index quotes_company_id_idx on public.quotes (company_id);
-- A company has at most one live (non-withdrawn) quote per job.
create unique index quotes_one_live_per_company_job
  on public.quotes (job_id, company_id) where status <> 'withdrawn';

alter table public.jobs
  add constraint jobs_awarded_quote_fk
  foreign key (awarded_quote_id) references public.quotes (id);

create table public.quote_lines (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.quotes (id) on delete cascade,
  charge_name  text not null check (char_length(btrim(charge_name)) between 1 and 120),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 100000000000),
  currency     char(3) not null check (currency ~ '^[A-Z]{3}$'),
  gst_included boolean not null default false
);
create index quote_lines_quote_id_idx on public.quote_lines (quote_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger quotes_touch_updated_at
  before update on public.quotes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies never recurse into RLS)
-- ---------------------------------------------------------------------------

create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.current_company_active()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.status = 'active'
       from public.profiles p join public.companies c on c.id = p.company_id
      where p.id = auth.uid()),
    false)
$$;

-- ---------------------------------------------------------------------------
-- New auth users get a profile row
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Onboarding: creates the company (trust level basic) and links the user to it
-- ---------------------------------------------------------------------------

create or replace function public.onboard(p_company_name text, p_country text, p_role text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and company_id is not null) then
    raise exception 'Already onboarded' using errcode = '23505';
  end if;
  insert into public.companies (name, country, role)
  values (btrim(p_company_name), btrim(p_country), p_role)
  returning id into v_company;
  update public.profiles set company_id = v_company where id = auth.uid();
  return v_company;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.companies   enable row level security;
alter table public.profiles    enable row level security;
alter table public.ports       enable row level security;
alter table public.jobs        enable row level security;
alter table public.quotes      enable row level security;
alter table public.quote_lines enable row level security;

-- Start from nothing, then grant only what the app needs. RLS narrows it further.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ports: readable by signed-in users
grant select on public.ports to authenticated;
create policy ports_select on public.ports for select to authenticated using (true);

-- companies: names and trust level are visible to signed-in users; only admins change them (SEC-6)
grant select on public.companies to authenticated;
grant update (trust_level, status) on public.companies to authenticated;
create policy companies_select on public.companies for select to authenticated using (true);
create policy companies_admin_update on public.companies for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles (SEC-2): own row, same company, or admin. The other party after award
-- reads contacts only through get_award_contacts().
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (company_id is not null and company_id = public.current_company_id())
    or public.is_admin()
  );
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- jobs: a public board for signed-in users. Inserts only for the caller's own active company (SEC-5, SEC-6).
-- No update or delete privilege exists: awarding goes through award_quote().
grant select on public.jobs to authenticated;
grant insert (
  company_id, created_by, direction, incoterm, mode, origin_port_id, destination_port_id,
  container_type, container_qty, weight_kg, volume_cbm, cargo_description, ready_date,
  services, flag_dg, flag_reefer, flag_bmsb, deadline_at, notes
) on public.jobs to authenticated;
create policy jobs_select on public.jobs for select to authenticated
  using (status <> 'cancelled' or company_id = public.current_company_id());
create policy jobs_insert on public.jobs for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and created_by = auth.uid()
    and public.current_company_active()
    and deadline_at > now()
  );

-- quotes (SEC-1, SEC-4, SEC-5): the poster's company reads quotes on its jobs (not withdrawn),
-- a quoting company reads only its own.
grant select on public.quotes to authenticated;
grant insert (job_id, company_id, created_by, valid_until, notes) on public.quotes to authenticated;
grant update (valid_until, notes, status) on public.quotes to authenticated;
create policy quotes_select on public.quotes for select to authenticated
  using (
    company_id = public.current_company_id()
    or (
      status <> 'withdrawn'
      and exists (
        select 1 from public.jobs j
         where j.id = quotes.job_id and j.company_id = public.current_company_id()
      )
    )
  );
create policy quotes_insert on public.quotes for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and created_by = auth.uid()
    and public.current_company_active()
    and exists (
      select 1 from public.jobs j
       where j.id = quotes.job_id
         and j.status = 'open'
         and j.deadline_at > now()
         and j.company_id <> public.current_company_id()
    )
  );
create policy quotes_update on public.quotes for update to authenticated
  using (
    company_id = public.current_company_id()
    and status = 'sent'
    and public.current_company_active()
    and exists (
      select 1 from public.jobs j
       where j.id = quotes.job_id and j.status = 'open' and j.deadline_at > now()
    )
  )
  with check (
    company_id = public.current_company_id()
    and status in ('sent', 'withdrawn')
  );

-- quote_lines follow their quote.
grant select, insert, delete on public.quote_lines to authenticated;
create policy quote_lines_select on public.quote_lines for select to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_lines.quote_id));
create policy quote_lines_insert on public.quote_lines for insert to authenticated
  with check (
    exists (
      select 1 from public.quotes q
        join public.jobs j on j.id = q.job_id
       where q.id = quote_lines.quote_id
         and q.company_id = public.current_company_id()
         and q.status = 'sent'
         and public.current_company_active()
         and j.status = 'open'
         and j.deadline_at > now()
    )
  );
create policy quote_lines_delete on public.quote_lines for delete to authenticated
  using (
    exists (
      select 1 from public.quotes q
        join public.jobs j on j.id = q.job_id
       where q.id = quote_lines.quote_id
         and q.company_id = public.current_company_id()
         and q.status = 'sent'
         and public.current_company_active()
         and j.status = 'open'
         and j.deadline_at > now()
    )
  );

-- ---------------------------------------------------------------------------
-- Quote RPCs. Security invoker: RLS still applies; they only make the writes atomic.
-- ---------------------------------------------------------------------------

create or replace function public.submit_quote(
  p_job_id uuid, p_valid_until date, p_notes text, p_lines jsonb
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 20 then
    raise exception 'A quote needs between 1 and 20 line items' using errcode = '22023';
  end if;
  insert into public.quotes (job_id, company_id, created_by, valid_until, notes)
  values (p_job_id, public.current_company_id(), auth.uid(), p_valid_until, nullif(btrim(p_notes), ''))
  returning id into v_id;
  insert into public.quote_lines (quote_id, charge_name, amount_minor, currency, gst_included)
  select v_id, l->>'charge_name', (l->>'amount_minor')::bigint, upper(l->>'currency'),
         coalesce((l->>'gst_included')::boolean, false)
    from jsonb_array_elements(p_lines) l;
  return v_id;
end $$;

create or replace function public.update_quote(
  p_quote_id uuid, p_valid_until date, p_notes text, p_lines jsonb
) returns void language plpgsql security invoker set search_path = public as $$
declare
  v_rows integer;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 20 then
    raise exception 'A quote needs between 1 and 20 line items' using errcode = '22023';
  end if;
  update public.quotes
     set valid_until = p_valid_until, notes = nullif(btrim(p_notes), '')
   where id = p_quote_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Quote cannot be changed' using errcode = '42501';
  end if;
  delete from public.quote_lines where quote_id = p_quote_id;
  insert into public.quote_lines (quote_id, charge_name, amount_minor, currency, gst_included)
  select p_quote_id, l->>'charge_name', (l->>'amount_minor')::bigint, upper(l->>'currency'),
         coalesce((l->>'gst_included')::boolean, false)
    from jsonb_array_elements(p_lines) l;
end $$;

create or replace function public.withdraw_quote(p_quote_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_rows integer;
begin
  update public.quotes set status = 'withdrawn' where id = p_quote_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Quote cannot be withdrawn' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Award (SEC-3): Verified, active poster company, own open job, live quote.
-- ---------------------------------------------------------------------------

create or replace function public.award_quote(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_company  public.companies;
  v_job      public.jobs;
  v_quote    public.quotes;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id;
  if not found then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;

  select * into v_job from public.jobs where id = v_quote.job_id for update;

  select c.* into v_company
    from public.companies c
    join public.profiles p on p.company_id = c.id
   where p.id = auth.uid();

  if not found or v_job.company_id <> v_company.id then
    raise exception 'Only the job poster can award' using errcode = '42501';
  end if;
  if v_company.status <> 'active' then
    raise exception 'Suspended companies cannot award' using errcode = '42501';
  end if;
  if v_company.trust_level <> 'verified' then
    raise exception 'Get verified to award' using errcode = '42501';
  end if;
  if v_job.status <> 'open' then
    raise exception 'Job is not open' using errcode = '22023';
  end if;
  if v_quote.status <> 'sent' then
    raise exception 'Quote is not live' using errcode = '22023';
  end if;

  update public.quotes set status = 'won' where id = p_quote_id;
  update public.quotes set status = 'lost'
   where job_id = v_job.id and id <> p_quote_id and status = 'sent';
  update public.jobs set status = 'awarded', awarded_quote_id = p_quote_id where id = v_job.id;
end $$;

-- ---------------------------------------------------------------------------
-- Contact handoff (SEC-2): only the poster and the winner, only after award.
-- ---------------------------------------------------------------------------

create or replace function public.get_award_contacts(p_job_id uuid)
returns table (party text, company_name text, full_name text, email text, phone text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_me     uuid := public.current_company_id();
  v_job    public.jobs;
  v_quote  public.quotes;
begin
  if auth.uid() is null or v_me is null then
    return;
  end if;
  select * into v_job from public.jobs where id = p_job_id;
  if not found or v_job.status <> 'awarded' or v_job.awarded_quote_id is null then
    return;
  end if;
  select * into v_quote from public.quotes where id = v_job.awarded_quote_id;
  if v_me <> v_job.company_id and v_me <> v_quote.company_id then
    return;
  end if;

  return query
    select 'poster'::text, c.name, p.full_name, p.email, p.phone
      from public.profiles p join public.companies c on c.id = p.company_id
     where p.id = v_job.created_by
    union all
    select 'winner'::text, c.name, p.full_name, p.email, p.phone
      from public.profiles p join public.companies c on c.id = p.company_id
     where p.id = v_quote.created_by;
end $$;

-- Function privileges: signed-in users only.
revoke all on function public.onboard(text, text, text) from public, anon;
revoke all on function public.submit_quote(uuid, date, text, jsonb) from public, anon;
revoke all on function public.update_quote(uuid, date, text, jsonb) from public, anon;
revoke all on function public.withdraw_quote(uuid) from public, anon;
revoke all on function public.award_quote(uuid) from public, anon;
revoke all on function public.get_award_contacts(uuid) from public, anon;
revoke all on function public.current_company_id() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.current_company_active() from public, anon;
grant execute on function public.onboard(text, text, text) to authenticated;
grant execute on function public.submit_quote(uuid, date, text, jsonb) to authenticated;
grant execute on function public.update_quote(uuid, date, text, jsonb) to authenticated;
grant execute on function public.withdraw_quote(uuid) to authenticated;
grant execute on function public.award_quote(uuid) to authenticated;
grant execute on function public.get_award_contacts(uuid) to authenticated;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_company_active() to authenticated;

-- Trigger functions are never called directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
