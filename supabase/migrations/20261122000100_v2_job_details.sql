-- v2 phase 1: richer job details, the delivery street address released only at award, and
-- competition bands for the job board. No existing rule is relaxed.

-- ---------------------------------------------------------------------------
-- New job fields (public on the board, like the rest of a job)
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column delivery_suburb   text check (delivery_suburb is null or char_length(btrim(delivery_suburb)) between 2 and 80),
  add column delivery_postcode text check (delivery_postcode is null or delivery_postcode ~ '^[0-9]{4}$'),
  add column unload_type       text check (unload_type is null or unload_type in
                                 ('forklift', 'tailgate', 'side_loader', 'dock', 'customer_unpacks')),
  add column repeat_frequency  text not null default 'one_off'
                                 check (repeat_frequency in ('one_off', 'weekly', 'monthly', 'quarterly')),
  add column repeat_volume     text check (repeat_volume is null or char_length(btrim(repeat_volume)) between 1 and 120),
  add column required_by       date;

-- NOT VALID: existing jobs keep working; every new or changed row must pass.
alter table public.jobs
  add constraint jobs_required_after_ready
    check (required_by is null or required_by >= ready_date) not valid,
  add constraint jobs_delivery_needs_place
    check (
      not ('delivery' = any (services))
      or (delivery_suburb is not null and delivery_postcode is not null and unload_type is not null)
    ) not valid;

grant insert (delivery_suburb, delivery_postcode, unload_type, repeat_frequency, repeat_volume, required_by)
  on public.jobs to authenticated;

-- ---------------------------------------------------------------------------
-- Delivery street address: written at award, readable only by the requester and the winner
-- ---------------------------------------------------------------------------

create table public.job_delivery_addresses (
  job_id     uuid primary key references public.jobs (id) on delete cascade,
  street     text not null check (char_length(btrim(street)) between 3 and 200),
  created_at timestamptz not null default now()
);

alter table public.job_delivery_addresses enable row level security;
revoke all on public.job_delivery_addresses from public, anon, authenticated;
grant select on public.job_delivery_addresses to authenticated;

-- No insert, update or delete privilege: the only writer is award_quote_with_address().
create policy job_delivery_addresses_select on public.job_delivery_addresses for select to authenticated
  using (
    exists (
      select 1
        from public.jobs j
       where j.id = job_delivery_addresses.job_id
         and j.status = 'awarded'
         and (
           j.company_id = public.current_company_id()
           or exists (
             select 1 from public.quotes q
              where q.id = j.awarded_quote_id and q.company_id = public.current_company_id()
           )
         )
    )
  );

-- Awards a quote and stores the street address in one transaction. Every award rule (SEC-3) stays
-- in award_quote(); if the address is missing or invalid the whole award rolls back.
create or replace function public.award_quote_with_address(p_quote_id uuid, p_street text)
returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_job    public.jobs;
  v_street text := nullif(btrim(coalesce(p_street, '')), '');
begin
  perform public.award_quote(p_quote_id);

  select j.* into v_job
    from public.jobs j
    join public.quotes q on q.job_id = j.id
   where q.id = p_quote_id;

  if 'delivery' = any (v_job.services) and v_street is null then
    raise exception 'Enter the delivery street address' using errcode = '22023';
  end if;

  if v_street is not null then
    if char_length(v_street) < 3 or char_length(v_street) > 200 then
      raise exception 'The street address must be 3 to 200 characters' using errcode = '22023';
    end if;
    insert into public.job_delivery_addresses (job_id, street) values (v_job.id, v_street);
  end if;
end $$;

revoke all on function public.award_quote_with_address(uuid, text) from public, anon;
grant execute on function public.award_quote_with_address(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Competition band for open jobs: none, few (1 to 3) or busy (4 or more). Never a count, never prices.
-- ---------------------------------------------------------------------------

create or replace function public.job_quote_bands(p_job_ids uuid[])
returns table (job_id uuid, band text)
language sql stable security definer set search_path = pg_catalog, public, pg_temp as $$
  select j.id,
         case
           when count(q.id) = 0 then 'none'
           when count(q.id) <= 3 then 'few'
           else 'busy'
         end
    from public.jobs j
    left join public.quotes q on q.job_id = j.id and q.status = 'sent'
   where auth.uid() is not null
     and j.status = 'open'
     and j.id = any (p_job_ids[1:200])
   group by j.id
$$;

revoke all on function public.job_quote_bands(uuid[]) from public, anon;
grant execute on function public.job_quote_bands(uuid[]) to authenticated;
