-- Dashboard statistics for admins.
-- These functions return counts and timings only. They never return quote amounts, notes or contact
-- details, so admins still have no access to quote contents. Both check is_admin() themselves.

create or replace function public.admin_marketplace_stats(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_days  integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
  v_jobs  jsonb;
  v_comp  jsonb;
  v_quotes integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  with wj as (
    select j.id, j.status, j.deadline_at, j.created_at,
           (select count(*) from public.quotes q where q.job_id = j.id and q.status <> 'withdrawn') as live_quotes,
           (select min(q.created_at) from public.quotes q where q.job_id = j.id) as first_quote_at
      from public.jobs j
     where j.created_at >= v_since
  )
  select jsonb_build_object(
    'posted',               count(*),
    'awarded',              count(*) filter (where status = 'awarded'),
    'cancelled',            count(*) filter (where status = 'cancelled'),
    'open_now',             count(*) filter (where status = 'open' and deadline_at > now()),
    'awaiting_award',       count(*) filter (where status = 'open' and live_quotes > 0),
    'expired_no_quotes',    count(*) filter (where status = 'open' and deadline_at <= now() and live_quotes = 0),
    'with_quotes',          count(*) filter (where live_quotes > 0),
    'avg_quotes_per_job',   coalesce(round(avg(live_quotes)::numeric, 2), 0),
    'median_hours_to_first_quote',
      round((percentile_cont(0.5) within group (
        order by extract(epoch from (first_quote_at - created_at)) / 3600.0
      ) filter (where first_quote_at is not null))::numeric, 1)
  ) into v_jobs
  from wj;

  select count(*) into v_quotes from public.quotes where created_at >= v_since;

  select jsonb_build_object(
    'total',      count(*),
    'verified',   count(*) filter (where trust_level = 'verified'),
    'basic',      count(*) filter (where trust_level = 'basic'),
    'suspended',  count(*) filter (where status = 'suspended'),
    'agents',     count(*) filter (where role = 'agent'),
    'forwarders', count(*) filter (where role = 'forwarder'),
    'new_in_window', count(*) filter (where created_at >= v_since)
  ) into v_comp
  from public.companies;

  return jsonb_build_object(
    'days', v_days,
    'jobs', v_jobs,
    'quotes_sent', v_quotes,
    'companies', v_comp
  );
end $$;

-- Basic companies whose open jobs have live quotes waiting: they cannot award until verified.
create or replace function public.admin_verification_queue()
returns table (
  company_id uuid, company_name text, company_country text, company_role text,
  joined_at timestamptz, awaiting_jobs integer, waiting_quotes integer
) language plpgsql stable security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select c.id, c.name, c.country, c.role, c.created_at,
           count(distinct j.id)::integer,
           count(q.id)::integer
      from public.companies c
      join public.jobs j on j.company_id = c.id and j.status = 'open'
      join public.quotes q on q.job_id = j.id and q.status = 'sent'
     where c.trust_level = 'basic' and c.status = 'active'
     group by c.id, c.name, c.country, c.role, c.created_at
     order by count(q.id) desc, c.created_at
     limit 20;
end $$;

revoke all on function public.admin_marketplace_stats(integer) from public, anon;
revoke all on function public.admin_verification_queue() from public, anon;
grant execute on function public.admin_marketplace_stats(integer) to authenticated;
grant execute on function public.admin_verification_queue() to authenticated;
