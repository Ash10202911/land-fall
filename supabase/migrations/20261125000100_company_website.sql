-- Sign-up asks for a company website so an admin can check who a company is before verifying it.
-- The website is for that check, not for other companies to browse, so it lives in its own table that
-- only the company itself and admins can read. Existing companies have none; every new company must give one.

create table public.company_sites (
  company_id uuid primary key references public.companies (id) on delete cascade,
  website    text not null
    check (char_length(website) between 8 and 200 and website ~* '^https?://[^[:space:]/]+\.[^[:space:]/]{2,}(/[^[:space:]]*)?$'),
  created_at timestamptz not null default now()
);

alter table public.company_sites enable row level security;
revoke all on public.company_sites from public, anon, authenticated;
-- Read only. The only writer is onboard().
grant select on public.company_sites to authenticated;

create policy company_sites_select on public.company_sites for select to authenticated
  using (company_id = public.current_company_id() or public.is_admin());

-- onboard now needs a website. The old three-argument version is removed so the API cannot skip it.
drop function public.onboard(text, text, text);

create or replace function public.onboard(p_company_name text, p_country text, p_role text, p_website text)
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
  if p_website is null or btrim(p_website) = '' then
    raise exception 'A company website is required' using errcode = '22023';
  end if;
  insert into public.companies (name, country, role)
  values (btrim(p_company_name), btrim(p_country), p_role)
  returning id into v_company;
  insert into public.company_sites (company_id, website) values (v_company, btrim(p_website));
  update public.profiles set company_id = v_company where id = auth.uid();
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  return v_company;
end $$;

revoke all on function public.onboard(text, text, text, text) from public, anon;
grant execute on function public.onboard(text, text, text, text) to authenticated;
