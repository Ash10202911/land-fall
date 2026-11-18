-- Job cancel and edit, admin guards and audit log, abuse limits, and admin posting on behalf of a company.
-- Triggers that limit API users check auth.uid() so service-role and SQL-editor maintenance is not blocked.

-- ---------------------------------------------------------------------------
-- Admin audit log (append-only, written by a trigger, readable by admins only)
-- ---------------------------------------------------------------------------

create table public.admin_audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  company_id uuid not null references public.companies (id) on delete cascade,
  field      text not null check (field in ('trust_level', 'status')),
  old_value  text not null,
  new_value  text not null,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;
create policy admin_audit_log_select on public.admin_audit_log for select to authenticated
  using (public.is_admin());

create or replace function public.log_company_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if new.trust_level is distinct from old.trust_level then
    insert into public.admin_audit_log (actor_id, company_id, field, old_value, new_value)
    values (auth.uid(), new.id, 'trust_level', old.trust_level, new.trust_level);
  end if;
  if new.status is distinct from old.status then
    insert into public.admin_audit_log (actor_id, company_id, field, old_value, new_value)
    values (auth.uid(), new.id, 'status', old.status, new.status);
  end if;
  return new;
end $$;

create trigger companies_audit
  after update on public.companies
  for each row execute function public.log_company_change();

-- An admin cannot verify, downgrade, suspend or unsuspend their own company.
create or replace function public.block_own_company_admin_change()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
begin
  if auth.uid() is not null
     and old.id = public.current_company_id()
     and (new.trust_level is distinct from old.trust_level or new.status is distinct from old.status) then
    raise exception 'Admins cannot change the trust level or status of their own company' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger companies_block_self_change
  before update on public.companies
  for each row execute function public.block_own_company_admin_change();

-- ---------------------------------------------------------------------------
-- Database checks and abuse limits for API users
-- ---------------------------------------------------------------------------

create or replace function public.check_quote_limits()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.valid_until < (now() at time zone 'utc')::date then
      raise exception 'Quote validity cannot be in the past' using errcode = '22023';
    end if;
    -- Withdrawing and resubmitting is allowed, but not without limit.
    if (select count(*) from public.quotes q
         where q.job_id = new.job_id and q.company_id = new.company_id) >= 5 then
      raise exception 'Too many quote attempts for this job' using errcode = '54000';
    end if;
  elsif new.valid_until is distinct from old.valid_until
        and new.valid_until < (now() at time zone 'utc')::date then
    raise exception 'Quote validity cannot be in the past' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger quotes_limits
  before insert or update on public.quotes
  for each row execute function public.check_quote_limits();

create or replace function public.check_job_limits()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if (select count(*) from public.jobs j
         where j.company_id = new.company_id
           and j.created_at > now() - interval '24 hours') >= 20 then
      raise exception 'Too many jobs posted in the last 24 hours' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;

create trigger jobs_limits
  before insert on public.jobs
  for each row execute function public.check_job_limits();

-- ---------------------------------------------------------------------------
-- Admins can post a job on behalf of any active company
-- ---------------------------------------------------------------------------

drop policy jobs_insert on public.jobs;
create policy jobs_insert on public.jobs for insert to authenticated
  with check (
    created_by = auth.uid()
    and deadline_at > now()
    and (
      (company_id = public.current_company_id() and public.current_company_active())
      or (
        public.is_admin()
        and exists (select 1 from public.companies c where c.id = jobs.company_id and c.status = 'active')
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Cancel and edit a job (poster only; there is still no direct update access to jobs)
-- ---------------------------------------------------------------------------

create or replace function public.cancel_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_job     public.jobs;
  v_company public.companies;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select * into v_job from public.jobs where id = p_job_id for update;
  select c.* into v_company
    from public.companies c join public.profiles p on p.company_id = c.id
   where p.id = auth.uid();
  if v_job.id is null or v_company.id is null or v_job.company_id <> v_company.id then
    raise exception 'Only the job poster can cancel' using errcode = '42501';
  end if;
  if v_company.status <> 'active' then
    raise exception 'Suspended companies cannot cancel' using errcode = '42501';
  end if;
  if v_job.status <> 'open' then
    raise exception 'Only an open job can be cancelled' using errcode = '22023';
  end if;
  update public.jobs set status = 'cancelled' where id = p_job_id;
  update public.quotes set status = 'lost' where job_id = p_job_id and status = 'sent';
end $$;

create or replace function public.update_job(
  p_job_id uuid, p_cargo_description text, p_notes text, p_ready_date date, p_deadline_at timestamptz
) returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_job     public.jobs;
  v_company public.companies;
  v_has_quotes boolean;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select * into v_job from public.jobs where id = p_job_id for update;
  select c.* into v_company
    from public.companies c join public.profiles p on p.company_id = c.id
   where p.id = auth.uid();
  if v_job.id is null or v_company.id is null or v_job.company_id <> v_company.id then
    raise exception 'Only the job poster can edit' using errcode = '42501';
  end if;
  if v_company.status <> 'active' then
    raise exception 'Suspended companies cannot edit' using errcode = '42501';
  end if;
  if v_job.status <> 'open' or v_job.deadline_at <= now() then
    raise exception 'Only an open job can be edited' using errcode = '22023';
  end if;
  if p_deadline_at < v_job.deadline_at or p_deadline_at <= now() then
    raise exception 'The deadline can only be extended' using errcode = '22023';
  end if;

  select exists (select 1 from public.quotes where job_id = p_job_id and status = 'sent') into v_has_quotes;
  if v_has_quotes
     and (p_cargo_description is distinct from v_job.cargo_description or p_ready_date is distinct from v_job.ready_date) then
    raise exception 'Cargo details cannot change once quotes exist' using errcode = '22023';
  end if;

  update public.jobs
     set cargo_description = p_cargo_description,
         notes = nullif(btrim(p_notes), ''),
         ready_date = p_ready_date,
         deadline_at = p_deadline_at
   where id = p_job_id;
end $$;

revoke all on function public.cancel_job(uuid) from public, anon;
revoke all on function public.update_job(uuid, text, text, date, timestamptz) from public, anon;
grant execute on function public.cancel_job(uuid) to authenticated;
grant execute on function public.update_job(uuid, text, text, date, timestamptz) to authenticated;

revoke all on function public.log_company_change() from public, anon, authenticated;
revoke all on function public.block_own_company_admin_change() from public, anon, authenticated;
revoke all on function public.check_quote_limits() from public, anon, authenticated;
revoke all on function public.check_job_limits() from public, anon, authenticated;
