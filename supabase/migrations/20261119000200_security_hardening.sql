-- Hardening from the security review.

-- award_quote: the winning quote's company must still be active, and a missing quote gives the same
-- error as a quote the caller may not award (no existence probe).
create or replace function public.award_quote(p_quote_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_company  public.companies;
  v_job      public.jobs;
  v_quote    public.quotes;
  v_quoter_active boolean;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id;
  if not found then
    raise exception 'Only the job poster can award' using errcode = '42501';
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

  select (status = 'active') into v_quoter_active from public.companies where id = v_quote.company_id;
  if not coalesce(v_quoter_active, false) then
    raise exception 'The quoting company is suspended' using errcode = '22023';
  end if;

  update public.quotes set status = 'won' where id = p_quote_id;
  update public.quotes set status = 'lost'
   where job_id = v_job.id and id <> p_quote_id and status = 'sent';
  update public.jobs set status = 'awarded', awarded_quote_id = p_quote_id where id = v_job.id;
end $$;

-- onboard: never leave a company without an owner.
create or replace function public.onboard(p_company_name text, p_country text, p_role text)
returns uuid language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_company uuid;
  v_rows integer;
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
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  return v_company;
end $$;

-- Pin search_path on the remaining definer functions.
alter function public.get_award_contacts(uuid) set search_path = pg_catalog, public, pg_temp;
alter function public.current_company_id() set search_path = pg_catalog, public, pg_temp;
alter function public.is_admin() set search_path = pg_catalog, public, pg_temp;
alter function public.current_company_active() set search_path = pg_catalog, public, pg_temp;
alter function public.handle_new_user() set search_path = pg_catalog, public, pg_temp;

-- Database-side checks, so direct API writes cannot store junk.
alter table public.profiles
  add constraint profiles_phone_format check (phone is null or phone ~ '^[0-9+()\-.\s]*$');
