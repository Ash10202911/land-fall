-- v2 phase 2: lane alerts and rate cards. Both belong to one company and are private to it.
-- Other companies and admins cannot read them. No existing rule is relaxed.

-- ---------------------------------------------------------------------------
-- Lane alerts: "email me when a matching job is posted"
-- ---------------------------------------------------------------------------

create table public.lane_alerts (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  created_by          uuid not null references public.profiles (id),
  origin_port_id      integer references public.ports (id),
  origin_country      text check (origin_country is null or char_length(btrim(origin_country)) between 2 and 80),
  destination_port_id integer not null references public.ports (id),
  modes               text[] not null default '{}' check (modes <@ array['FCL', 'LCL', 'Air']::text[]),
  destination_only    boolean not null default false,
  frequency           text not null default 'instant' check (frequency in ('instant', 'daily', 'off')),
  created_at          timestamptz not null default now(),
  constraint lane_alerts_one_origin check (origin_port_id is null or origin_country is null)
);
create index lane_alerts_company_idx on public.lane_alerts (company_id);
create index lane_alerts_match_idx on public.lane_alerts (destination_port_id, frequency);

alter table public.lane_alerts enable row level security;
revoke all on public.lane_alerts from public, anon, authenticated;
grant select, delete on public.lane_alerts to authenticated;
grant insert (company_id, created_by, origin_port_id, origin_country, destination_port_id, modes, destination_only, frequency)
  on public.lane_alerts to authenticated;
grant update (origin_port_id, origin_country, destination_port_id, modes, destination_only, frequency)
  on public.lane_alerts to authenticated;

create policy lane_alerts_select on public.lane_alerts for select to authenticated
  using (company_id = public.current_company_id());
create policy lane_alerts_insert on public.lane_alerts for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and created_by = auth.uid()
    and public.current_company_active()
  );
create policy lane_alerts_update on public.lane_alerts for update to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy lane_alerts_delete on public.lane_alerts for delete to authenticated
  using (company_id = public.current_company_id());

-- At most 20 alerts per company.
create or replace function public.check_lane_alert_limit()
returns trigger language plpgsql set search_path = pg_catalog, public, pg_temp as $$
begin
  if (select count(*) from public.lane_alerts where company_id = new.company_id) >= 20 then
    raise exception 'A company can have at most 20 lane alerts' using errcode = '54000';
  end if;
  return new;
end $$;
create trigger lane_alerts_limit before insert on public.lane_alerts
  for each row execute function public.check_lane_alert_limit();

-- Which alert has already been emailed about which job. Service role only: no policies, no grants.
create table public.lane_alert_deliveries (
  alert_id uuid not null references public.lane_alerts (id) on delete cascade,
  job_id   uuid not null references public.jobs (id) on delete cascade,
  sent_at  timestamptz not null default now(),
  primary key (alert_id, job_id)
);
alter table public.lane_alert_deliveries enable row level security;
revoke all on public.lane_alert_deliveries from public, anon, authenticated;
-- An explicit deny-all policy, so the intent is on record: only the server (service role) uses this table.
create policy lane_alert_deliveries_deny_all on public.lane_alert_deliveries
  as restrictive for all to authenticated, anon using (false) with check (false);

-- ---------------------------------------------------------------------------
-- Rate cards: a company's destination prices, used to pre-fill a quote
-- ---------------------------------------------------------------------------

create table public.rate_cards (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  created_by          uuid not null references public.profiles (id),
  name                text not null check (char_length(btrim(name)) between 2 and 80),
  destination_port_id integer not null references public.ports (id),
  currency            text not null check (currency in ('AUD', 'NZD', 'USD', 'EUR', 'GBP', 'CNY', 'SGD', 'HKD', 'JPY', 'INR')),
  valid_to            date not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index rate_cards_company_idx on public.rate_cards (company_id);
create index rate_cards_port_idx on public.rate_cards (company_id, destination_port_id);

-- One row per fixed charge, or per cartage zone (a postcode range with a price).
create table public.rate_card_charges (
  id            uuid primary key default gen_random_uuid(),
  rate_card_id  uuid not null references public.rate_cards (id) on delete cascade,
  position      integer not null default 0,
  kind          text not null check (kind in ('charge', 'zone')),
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  category      text not null check (category in ('destination', 'customs', 'delivery')),
  basis         text not null check (basis in ('per_job', 'per_container', 'per_20ft', 'per_40ft', 'per_cbm', 'per_kg')),
  amount_minor  bigint not null check (amount_minor > 0 and amount_minor <= 100000000),
  gst_included  boolean not null default true,
  postcode_from integer check (postcode_from between 0 and 9999),
  postcode_to   integer check (postcode_to between 0 and 9999),
  unload_type   text check (unload_type in ('forklift', 'tailgate', 'side_loader', 'dock', 'customer_unpacks')),
  constraint rate_zone_needs_range check ((kind = 'zone') = (postcode_from is not null and postcode_to is not null)),
  constraint rate_zone_range_order check (postcode_from is null or postcode_from <= postcode_to),
  constraint rate_zone_is_delivery check (kind <> 'zone' or category = 'delivery'),
  constraint rate_unload_is_delivery check (unload_type is null or (kind = 'charge' and category = 'delivery'))
);
create index rate_card_charges_card_idx on public.rate_card_charges (rate_card_id);

alter table public.rate_cards enable row level security;
alter table public.rate_card_charges enable row level security;
revoke all on public.rate_cards from public, anon, authenticated;
revoke all on public.rate_card_charges from public, anon, authenticated;
grant select, delete on public.rate_cards to authenticated;
grant insert (company_id, created_by, name, destination_port_id, currency, valid_to) on public.rate_cards to authenticated;
grant update (name, destination_port_id, currency, valid_to, updated_at) on public.rate_cards to authenticated;
grant select, delete on public.rate_card_charges to authenticated;
grant insert (rate_card_id, position, kind, name, category, basis, amount_minor, gst_included, postcode_from, postcode_to, unload_type)
  on public.rate_card_charges to authenticated;

create policy rate_cards_select on public.rate_cards for select to authenticated
  using (company_id = public.current_company_id());
create policy rate_cards_insert on public.rate_cards for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and created_by = auth.uid()
    and public.current_company_active()
  );
create policy rate_cards_update on public.rate_cards for update to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy rate_cards_delete on public.rate_cards for delete to authenticated
  using (company_id = public.current_company_id());

create policy rate_card_charges_select on public.rate_card_charges for select to authenticated
  using (exists (select 1 from public.rate_cards c where c.id = rate_card_id and c.company_id = public.current_company_id()));
create policy rate_card_charges_insert on public.rate_card_charges for insert to authenticated
  with check (exists (select 1 from public.rate_cards c where c.id = rate_card_id and c.company_id = public.current_company_id()));
create policy rate_card_charges_delete on public.rate_card_charges for delete to authenticated
  using (exists (select 1 from public.rate_cards c where c.id = rate_card_id and c.company_id = public.current_company_id()));

-- At most 10 rate cards per company.
create or replace function public.check_rate_card_limit()
returns trigger language plpgsql set search_path = pg_catalog, public, pg_temp as $$
begin
  if (select count(*) from public.rate_cards where company_id = new.company_id) >= 10 then
    raise exception 'A company can have at most 10 rate cards' using errcode = '54000';
  end if;
  return new;
end $$;
create trigger rate_cards_limit before insert on public.rate_cards
  for each row execute function public.check_rate_card_limit();

-- Creates or replaces a rate card and all its rows in one transaction. Security invoker: Row Level
-- Security applies, so a company can only touch its own cards.
create or replace function public.save_rate_card(
  p_id uuid, p_name text, p_port integer, p_currency text, p_valid_to date, p_charges jsonb
) returns uuid language plpgsql set search_path = pg_catalog, public, pg_temp as $$
declare
  v_company uuid := public.current_company_id();
  v_id uuid;
begin
  if auth.uid() is null or v_company is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if not public.current_company_active() then
    raise exception 'Suspended companies cannot save rate cards' using errcode = '42501';
  end if;
  if p_valid_to is null or p_valid_to < current_date then
    raise exception 'The valid-to date cannot be in the past' using errcode = '22023';
  end if;
  if jsonb_typeof(p_charges) is distinct from 'array' or jsonb_array_length(p_charges) not between 1 and 40 then
    raise exception 'A rate card needs 1 to 40 charges' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.rate_cards (company_id, created_by, name, destination_port_id, currency, valid_to)
    values (v_company, auth.uid(), p_name, p_port, p_currency, p_valid_to)
    returning id into v_id;
  else
    update public.rate_cards
       set name = p_name, destination_port_id = p_port, currency = p_currency, valid_to = p_valid_to, updated_at = now()
     where id = p_id and company_id = v_company
    returning id into v_id;
    if v_id is null then
      raise exception 'Rate card not found' using errcode = '42501';
    end if;
    delete from public.rate_card_charges where rate_card_id = v_id;
  end if;

  insert into public.rate_card_charges
    (rate_card_id, position, kind, name, category, basis, amount_minor, gst_included, postcode_from, postcode_to, unload_type)
  select v_id, (t.ord - 1)::integer, t.e ->> 'kind', t.e ->> 'name', t.e ->> 'category', t.e ->> 'basis',
         (t.e ->> 'amount_minor')::bigint, coalesce((t.e ->> 'gst_included')::boolean, true),
         nullif(t.e ->> 'postcode_from', '')::integer, nullif(t.e ->> 'postcode_to', '')::integer,
         nullif(t.e ->> 'unload_type', '')
    from jsonb_array_elements(p_charges) with ordinality as t(e, ord);

  return v_id;
end $$;

revoke all on function public.save_rate_card(uuid, text, integer, text, date, jsonb) from public, anon;
grant execute on function public.save_rate_card(uuid, text, integer, text, date, jsonb) to authenticated;
