-- v2 phase 3: each person's language. It drives the screens and the emails they receive.
-- A person can only change their own (the existing profile update policy); no one can read another
-- company's profile rows anyway (SEC-2).

alter table public.profiles
  add column language text not null default 'en' check (language in ('en', 'zh'));

grant update (language) on public.profiles to authenticated;
