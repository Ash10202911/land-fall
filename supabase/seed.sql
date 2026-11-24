-- Local demo data so every screen is populated (ports live in a migration).
-- Runs on `npm run db:reset`. Never applied to production.

-- ---------------------------------------------------------------------------
-- Demo companies, users, jobs and quotes
-- Sign in locally with any of these emails; the magic link arrives in Mailpit (http://127.0.0.1:54324).
--   admin@southbound.test   Admin (Verified forwarder)
--   agent@demo.test         Shenzhen Star Logistics (Verified agent)
--   agent2@demo.test        Mumbai Cargo Link (Basic agent)
--   fwd1@demo.test          Harbour Freight Pty Ltd (Verified forwarder)
--   fwd2@demo.test          Kiwi Sea and Air Ltd (Basic forwarder)
-- ---------------------------------------------------------------------------

insert into public.companies (id, name, country, role, trust_level, status) values
  ('c0000000-0000-4000-8000-000000000001', 'Southbound HQ', 'Australia', 'forwarder', 'verified', 'active'),
  ('c0000000-0000-4000-8000-000000000002', 'Shenzhen Star Logistics', 'China', 'agent', 'verified', 'active'),
  ('c0000000-0000-4000-8000-000000000003', 'Mumbai Cargo Link', 'India', 'agent', 'basic', 'active'),
  ('c0000000-0000-4000-8000-000000000004', 'Harbour Freight Pty Ltd', 'Australia', 'forwarder', 'verified', 'active'),
  ('c0000000-0000-4000-8000-000000000005', 'Kiwi Sea and Air Ltd', 'New Zealand', 'forwarder', 'basic', 'active');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token,
  is_sso_user, is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
  '', '', '', '', '', '', '', '', false, false
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@southbound.test'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'agent@demo.test'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'agent2@demo.test'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'fwd1@demo.test'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'fwd2@demo.test')
) as u(id, email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users u
 where u.email in ('admin@southbound.test', 'agent@demo.test', 'agent2@demo.test', 'fwd1@demo.test', 'fwd2@demo.test');

-- The signup trigger created the profile rows; complete them.
update public.profiles set company_id = 'c0000000-0000-4000-8000-000000000001', is_admin = true,
  full_name = 'Sam Founder', phone = '+61 2 5550 0001' where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set company_id = 'c0000000-0000-4000-8000-000000000002',
  full_name = 'Li Wei', phone = '+86 755 5550 0002' where id = 'a0000000-0000-4000-8000-000000000002';
update public.profiles set company_id = 'c0000000-0000-4000-8000-000000000003',
  full_name = 'Priya Nair', phone = '+91 22 5550 0003' where id = 'a0000000-0000-4000-8000-000000000003';
update public.profiles set company_id = 'c0000000-0000-4000-8000-000000000004',
  full_name = 'Jack Thompson', phone = '+61 3 5550 0004' where id = 'a0000000-0000-4000-8000-000000000004';
update public.profiles set company_id = 'c0000000-0000-4000-8000-000000000005',
  full_name = 'Aroha Williams', phone = '+64 9 555 0005' where id = 'a0000000-0000-4000-8000-000000000005';

-- Jobs
insert into public.jobs (
  id, company_id, created_by, direction, incoterm, mode, origin_port_id, destination_port_id,
  container_type, container_qty, weight_kg, volume_cbm, cargo_description, ready_date,
  services, flag_dg, flag_reefer, flag_bmsb, deadline_at, notes, status, created_at,
  delivery_suburb, delivery_postcode, unload_type, repeat_frequency, repeat_volume, required_by
) values
  -- Open: Shenzhen to Melbourne, 2 x 40HC of furniture, with a live quote from fwd1
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'import', 'FOB', 'FCL',
   (select id from public.ports where code = 'CNSZX'), (select id from public.ports where code = 'AUMEL'),
   '40HC', 2, null, null, 'Flat-pack timber furniture, palletised', current_date + 14,
   array['destination_charges', 'customs_clearance', 'delivery'], false, false, true,
   now() + interval '5 days', 'BMSB treatment certificate will be provided.', 'open', now() - interval '2 hours',
   'Dandenong South VIC', '3175', 'side_loader', 'monthly', 'About 2 x 40HC each month', current_date + 45),
  -- Open: Ningbo to Sydney, LCL
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'import', 'EXW', 'LCL',
   (select id from public.ports where code = 'CNNGB'), (select id from public.ports where code = 'AUSYD'),
   null, null, 1850.00, 6.400, 'Industrial pumps in crates', current_date + 10,
   array['destination_charges', 'customs_clearance'], false, false, false,
   now() + interval '3 days', null, 'open', now() - interval '1 day',
   null, null, null, 'one_off', null, null),
  -- Open: Mumbai to Auckland, air freight
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003',
   'import', 'FCA', 'Air',
   (select id from public.ports where code = 'INNSA'), (select id from public.ports where code = 'NZAKL'),
   null, null, 420.50, 2.100, 'Textile samples and trims', current_date + 5,
   array['destination_charges', 'delivery'], false, false, false,
   now() + interval '2 days', 'Urgent. Priority uplift preferred.', 'open', now() - interval '3 hours',
   'East Tamaki, Auckland', '2013', 'tailgate', 'one_off', null, current_date + 9),
  -- Open export: Sydney to Singapore, FCL reefer, posted by a forwarder
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004',
   'export', 'FOB', 'FCL',
   (select id from public.ports where code = 'AUSYD'), (select id from public.ports where code = 'SGSIN'),
   '40RF', 1, null, null, 'Chilled beef, boxed', current_date + 7,
   array[]::text[], false, true, false,
   now() + interval '4 days', null, 'open', now() - interval '6 hours',
   null, null, null, 'weekly', '1 x 40RF each week', null),
  -- Closed: deadline passed, no award
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'import', 'CIF', 'FCL',
   (select id from public.ports where code = 'CNSHA'), (select id from public.ports where code = 'AUBNE'),
   '20GP', 1, null, null, 'Ceramic tiles', current_date + 3,
   array['customs_clearance'], false, false, false,
   now() - interval '1 day', null, 'open', now() - interval '6 days',
   null, null, null, 'one_off', null, null),
  -- Awarded: Shenzhen to Fremantle; fwd1 won, fwd2 lost
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'import', 'FOB', 'FCL',
   (select id from public.ports where code = 'CNSZX'), (select id from public.ports where code = 'AUFRE'),
   '40GP', 1, null, null, 'Consumer electronics accessories', current_date - 2,
   array['destination_charges', 'delivery'], false, false, false,
   now() - interval '3 days', null, 'open', now() - interval '10 days',
   'Kewdale WA', '6105', 'forklift', 'one_off', null, null);

-- Quotes
insert into public.quotes (id, job_id, company_id, created_by, valid_until, notes, status, created_at) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004',
   current_date + 21, 'Includes BMSB treatment liaison.', 'sent', now() - interval '1 hour'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005',
   current_date + 14, null, 'sent', now() - interval '30 minutes'),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000006',
   'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004',
   current_date + 10, null, 'won', now() - interval '8 days'),
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000006',
   'c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005',
   current_date + 10, null, 'lost', now() - interval '8 days');

insert into public.quote_lines (quote_id, charge_name, amount_minor, currency, gst_included) values
  ('d0000000-0000-4000-8000-000000000001', 'Destination terminal handling', 85000, 'AUD', true),
  ('d0000000-0000-4000-8000-000000000001', 'Customs clearance', 16500, 'AUD', true),
  ('d0000000-0000-4000-8000-000000000001', 'Delivery to Dandenong', 62000, 'AUD', true),
  ('d0000000-0000-4000-8000-000000000002', 'Destination charges', 112000, 'AUD', false),
  ('d0000000-0000-4000-8000-000000000002', 'Delivery', 58000, 'AUD', false),
  ('d0000000-0000-4000-8000-000000000003', 'Destination charges', 74000, 'AUD', true),
  ('d0000000-0000-4000-8000-000000000003', 'Delivery to Perth metro', 41000, 'AUD', true),
  ('d0000000-0000-4000-8000-000000000004', 'Destination charges', 90000, 'AUD', false);

update public.jobs set status = 'awarded', awarded_quote_id = 'd0000000-0000-4000-8000-000000000003'
 where id = 'b0000000-0000-4000-8000-000000000006';

insert into public.job_delivery_addresses (job_id, street) values
  ('b0000000-0000-4000-8000-000000000006', '14 Example Road');

-- Lane alerts and rate cards for Harbour Freight (fwd1), so the demo shows them straight away.
insert into public.lane_alerts (id, company_id, created_by, origin_country, destination_port_id, modes, destination_only, frequency) values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004',
   'China', (select id from public.ports where code = 'AUSYD'), array['FCL', 'LCL'], true, 'instant');
insert into public.lane_alerts (id, company_id, created_by, origin_port_id, destination_port_id, modes, destination_only, frequency) values
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004',
   (select id from public.ports where code = 'INNSA'), (select id from public.ports where code = 'AUSYD'), array['FCL'], false, 'daily');

insert into public.rate_cards (id, company_id, created_by, name, destination_port_id, currency, valid_to) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004',
   'Port Botany destination charges', (select id from public.ports where code = 'AUSYD'), 'AUD', current_date + 120),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004',
   'Auckland air handling and cartage', (select id from public.ports where code = 'NZAKL'), 'NZD', current_date + 120);

insert into public.rate_card_charges (rate_card_id, position, kind, name, category, basis, amount_minor, gst_included, postcode_from, postcode_to, unload_type) values
  ('f0000000-0000-4000-8000-000000000001', 0, 'charge', 'Port service charge (THC)', 'destination', 'per_40ft', 16500, true, null, null, null),
  ('f0000000-0000-4000-8000-000000000001', 1, 'charge', 'Delivery order fee', 'destination', 'per_job', 9500, true, null, null, null),
  ('f0000000-0000-4000-8000-000000000001', 2, 'charge', 'Customs entry', 'customs', 'per_job', 12000, true, null, null, null),
  ('f0000000-0000-4000-8000-000000000001', 3, 'zone', 'Zone 1 inner metro', 'delivery', 'per_container', 42000, true, 2000, 2050, null),
  ('f0000000-0000-4000-8000-000000000001', 4, 'zone', 'Zone 2 western Sydney', 'delivery', 'per_container', 56000, true, 2140, 2170, null),
  ('f0000000-0000-4000-8000-000000000001', 5, 'charge', 'Side-loader', 'delivery', 'per_container', 8000, true, null, null, 'side_loader'),
  ('f0000000-0000-4000-8000-000000000002', 0, 'charge', 'Airport handling', 'destination', 'per_kg', 40, true, null, null, null),
  ('f0000000-0000-4000-8000-000000000002', 1, 'zone', 'Auckland east', 'delivery', 'per_job', 18000, true, 2010, 2019, null),
  ('f0000000-0000-4000-8000-000000000002', 2, 'charge', 'Tailgate truck', 'delivery', 'per_job', 4500, true, null, null, 'tailgate');
