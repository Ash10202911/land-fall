-- v2 phase 3 ("decide"): quote line categories for like-for-like comparison, public questions and
-- answers on a job, and a capped one-tap extension for quiet jobs. No existing rule is relaxed.

-- ---------------------------------------------------------------------------
-- Quote line categories: what a line covers, so quotes can be compared like for like
-- ---------------------------------------------------------------------------

alter table public.quote_lines
  add column category text not null default 'other' check (category in ('destination', 'customs', 'delivery', 'other'));

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
  insert into public.quote_lines (quote_id, charge_name, amount_minor, currency, gst_included, category)
  select v_id, l->>'charge_name', (l->>'amount_minor')::bigint, upper(l->>'currency'),
         coalesce((l->>'gst_included')::boolean, false), coalesce(nullif(l->>'category', ''), 'other')
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
  insert into public.quote_lines (quote_id, charge_name, amount_minor, currency, gst_included, category)
  select p_quote_id, l->>'charge_name', (l->>'amount_minor')::bigint, upper(l->>'currency'),
         coalesce((l->>'gst_included')::boolean, false), coalesce(nullif(l->>'category', ''), 'other')
    from jsonb_array_elements(p_lines) l;
end $$;

-- ---------------------------------------------------------------------------
-- Public questions and answers
-- A question and its answer are public to every signed-in user. Who asked is not: it lives in a
-- separate table that only the asking company can read. An unanswered question is visible only to the
-- requester (to answer it) and to the company that asked it.
-- ---------------------------------------------------------------------------

-- Email addresses, phone numbers and links are how contact details would leak around the sealed rules.
create or replace function public.contains_contact_details(p_text text)
returns boolean language sql immutable set search_path = pg_catalog, public, pg_temp as $$
  select coalesce(
    p_text ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
    or p_text ~ '\+?[0-9][0-9 ().-]{6,}[0-9]'
    or p_text ~* '(https?://|www\.)',
    false)
$$;
revoke all on function public.contains_contact_details(text) from public, anon, authenticated;

create table public.job_questions (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  question    text not null check (char_length(btrim(question)) between 5 and 500),
  answer      text check (answer is null or char_length(btrim(answer)) between 1 and 1000),
  created_at  timestamptz not null default now(),
  answered_at timestamptz,
  constraint job_questions_answer_pair check ((answer is null) = (answered_at is null))
);
create index job_questions_job_idx on public.job_questions (job_id, created_at);

create table public.job_question_authors (
  question_id uuid primary key references public.job_questions (id) on delete cascade,
  company_id  uuid not null references public.companies (id),
  created_by  uuid not null references public.profiles (id)
);
create index job_question_authors_company_idx on public.job_question_authors (company_id, question_id);

alter table public.job_questions enable row level security;
alter table public.job_question_authors enable row level security;
revoke all on public.job_questions from public, anon, authenticated;
revoke all on public.job_question_authors from public, anon, authenticated;
-- No insert, update or delete privilege: the only writers are ask_question() and answer_question().
grant select on public.job_questions to authenticated;
grant select on public.job_question_authors to authenticated;

create policy job_questions_select on public.job_questions for select to authenticated
  using (
    -- The job itself must be visible to the caller (its own policy applies inside this subquery).
    exists (select 1 from public.jobs j where j.id = job_questions.job_id)
    and (
      answer is not null
      or exists (select 1 from public.jobs j where j.id = job_questions.job_id and j.company_id = public.current_company_id())
      or exists (select 1 from public.job_question_authors a where a.question_id = job_questions.id)
    )
  );

-- The asking company only. Not the requester, not other forwarders, not admins.
create policy job_question_authors_select on public.job_question_authors for select to authenticated
  using (company_id = public.current_company_id());

create or replace function public.ask_question(p_job_id uuid, p_question text)
returns uuid language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_company public.companies;
  v_job     public.jobs;
  v_text    text := btrim(coalesce(p_question, ''));
  v_id      uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select c.* into v_company
    from public.companies c join public.profiles p on p.company_id = c.id
   where p.id = auth.uid();
  if v_company.id is null or v_company.status <> 'active' then
    raise exception 'Your company cannot ask questions' using errcode = '42501';
  end if;
  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null or v_job.status <> 'open' or v_job.deadline_at <= now() then
    raise exception 'Questions are closed for this job' using errcode = '22023';
  end if;
  if v_job.company_id = v_company.id then
    raise exception 'You cannot ask a question on your own job' using errcode = '42501';
  end if;
  if char_length(v_text) < 5 or char_length(v_text) > 500 then
    raise exception 'A question must be 5 to 500 characters' using errcode = '22023';
  end if;
  if public.contains_contact_details(v_text) then
    raise exception 'Do not include contact details. They are shared after an award' using errcode = '22023';
  end if;
  if (select count(*) from public.job_question_authors a join public.job_questions q on q.id = a.question_id
       where a.company_id = v_company.id and q.job_id = p_job_id) >= 3 then
    raise exception 'You have asked the most questions allowed on this job' using errcode = '54000';
  end if;
  if (select count(*) from public.job_question_authors a join public.job_questions q on q.id = a.question_id
       where a.company_id = v_company.id and q.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Too many questions in the last 24 hours' using errcode = '54000';
  end if;

  insert into public.job_questions (job_id, question) values (p_job_id, v_text) returning id into v_id;
  insert into public.job_question_authors (question_id, company_id, created_by) values (v_id, v_company.id, auth.uid());
  return v_id;
end $$;

create or replace function public.answer_question(p_question_id uuid, p_answer text)
returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_company public.companies;
  v_job     public.jobs;
  v_text    text := btrim(coalesce(p_answer, ''));
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select c.* into v_company
    from public.companies c join public.profiles p on p.company_id = c.id
   where p.id = auth.uid();
  select j.* into v_job
    from public.jobs j join public.job_questions q on q.job_id = j.id
   where q.id = p_question_id;
  if v_job.id is null or v_company.id is null or v_job.company_id <> v_company.id then
    raise exception 'Only the requester can answer' using errcode = '42501';
  end if;
  if v_company.status <> 'active' then
    raise exception 'Suspended companies cannot answer' using errcode = '42501';
  end if;
  if v_job.status <> 'open' then
    raise exception 'Questions are closed for this job' using errcode = '22023';
  end if;
  if char_length(v_text) < 1 or char_length(v_text) > 1000 then
    raise exception 'An answer must be 1 to 1000 characters' using errcode = '22023';
  end if;
  if public.contains_contact_details(v_text) then
    raise exception 'Do not include contact details. They are shared after an award' using errcode = '22023';
  end if;
  update public.job_questions set answer = v_text, answered_at = now() where id = p_question_id;
end $$;

revoke all on function public.ask_question(uuid, text) from public, anon;
revoke all on function public.answer_question(uuid, text) from public, anon;
grant execute on function public.ask_question(uuid, text) to authenticated;
grant execute on function public.answer_question(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Extend a quiet job: 24 or 48 hours, only when no live quote exists and it closes within 12 hours,
-- at most twice. The requester only.
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column extensions smallint not null default 0 check (extensions between 0 and 2);

create or replace function public.extend_job(p_job_id uuid, p_hours integer)
returns timestamptz language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_company public.companies;
  v_job     public.jobs;
  v_new     timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_hours not in (24, 48) then
    raise exception 'Choose 24 or 48 hours' using errcode = '22023';
  end if;
  select * into v_job from public.jobs where id = p_job_id for update;
  select c.* into v_company
    from public.companies c join public.profiles p on p.company_id = c.id
   where p.id = auth.uid();
  if v_job.id is null or v_company.id is null or v_job.company_id <> v_company.id then
    raise exception 'Only the requester can extend' using errcode = '42501';
  end if;
  if v_company.status <> 'active' then
    raise exception 'Suspended companies cannot extend' using errcode = '42501';
  end if;
  if v_job.status <> 'open' or v_job.deadline_at <= now() then
    raise exception 'Only an open job can be extended' using errcode = '22023';
  end if;
  if v_job.deadline_at > now() + interval '12 hours' then
    raise exception 'A job can be extended in its last 12 hours' using errcode = '22023';
  end if;
  if exists (select 1 from public.quotes where job_id = p_job_id and status = 'sent') then
    raise exception 'A job with quotes cannot be extended this way' using errcode = '22023';
  end if;
  if v_job.extensions >= 2 then
    raise exception 'This job has already been extended twice' using errcode = '22023';
  end if;

  v_new := v_job.deadline_at + make_interval(hours => p_hours);
  update public.jobs set deadline_at = v_new, extensions = extensions + 1 where id = p_job_id;
  return v_new;
end $$;

revoke all on function public.extend_job(uuid, integer) from public, anon;
grant execute on function public.extend_job(uuid, integer) to authenticated;

-- Lane alerts can go out once more for each extension: one delivery per alert, job and round.
alter table public.lane_alert_deliveries add column round smallint not null default 0;
alter table public.lane_alert_deliveries drop constraint lane_alert_deliveries_pkey;
alter table public.lane_alert_deliveries add primary key (alert_id, job_id, round);
