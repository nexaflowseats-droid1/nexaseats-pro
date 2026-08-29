-- ============ ENUMS ============
create type public.org_role as enum ('owner','event_manager','event_staff');
create type public.event_status as enum ('draft','published','upcoming','live','completed','archived');
create type public.rsvp_status as enum ('pending','confirmed','declined','maybe');
create type public.table_type as enum ('round','square','rectangle','custom');
create type public.seating_preference as enum ('must_together','prefer_together','must_apart');
create type public.invitation_status as enum ('draft','sent','delivered','opened','confirmed');

-- ============ CORE ============
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text not null default '#f5b14a',
  plan text not null default 'free',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.org_role not null default 'event_manager',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
grant select, insert, update, delete on public.organization_members to authenticated;
grant all on public.organization_members to service_role;
alter table public.organization_members enable row level security;

-- ============ HELPERS ============
create or replace function public.is_org_member(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m
    where m.organization_id = _org and m.user_id = auth.uid());
$$;

create or replace function public.has_org_role(_org uuid, _role public.org_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m
    where m.organization_id = _org and m.user_id = auth.uid() and m.role = _role);
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ VENUES ============
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name text not null,
  address text,
  description text,
  capacity integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.venues to authenticated;
grant all on public.venues to service_role;
alter table public.venues enable row level security;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues on delete cascade,
  name text not null,
  capacity integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;

-- ============ EVENTS ============
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name text not null,
  description text,
  category text not null default 'corporate',
  event_date date,
  start_time time,
  end_time time,
  venue_id uuid references public.venues on delete set null,
  capacity integer not null default 100,
  status public.event_status not null default 'draft',
  cover_image text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create trigger events_updated before update on public.events for each row execute function public.set_updated_at();

create or replace function public.can_access_event(_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events e
    join public.organization_members m on m.organization_id = e.organization_id
    where e.id = _event and m.user_id = auth.uid());
$$;

create table public.floor_plans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  room_id uuid references public.rooms on delete set null,
  name text not null default 'Main Hall',
  background_pdf_url text,
  background_opacity numeric not null default 0.5,
  background_locked boolean not null default true,
  width integer not null default 1200,
  height integer not null default 800,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.floor_plans to authenticated;
grant all on public.floor_plans to service_role;
alter table public.floor_plans enable row level security;

create table public.event_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  floor_plan_id uuid references public.floor_plans on delete cascade,
  name text not null,
  table_number integer,
  table_type public.table_type not null default 'round',
  capacity integer not null default 8,
  position_x numeric not null default 100,
  position_y numeric not null default 100,
  width numeric not null default 120,
  height numeric not null default 120,
  rotation numeric not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.event_tables to authenticated;
grant all on public.event_tables to service_role;
alter table public.event_tables enable row level security;

create table public.floor_plan_objects (
  id uuid primary key default gen_random_uuid(),
  floor_plan_id uuid not null references public.floor_plans on delete cascade,
  label text not null,
  object_type text not null default 'stage',
  position_x numeric not null default 100,
  position_y numeric not null default 100,
  width numeric not null default 160,
  height numeric not null default 60,
  rotation numeric not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.floor_plan_objects to authenticated;
grant all on public.floor_plan_objects to service_role;
alter table public.floor_plan_objects enable row level security;

create table public.seats (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.event_tables on delete cascade,
  seat_number integer not null,
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (table_id, seat_number)
);
grant select, insert, update, delete on public.seats to authenticated;
grant all on public.seats to service_role;
alter table public.seats enable row level security;

-- ============ GUESTS ============
create table public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  name text not null,
  type text not null default 'family',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.guest_groups to authenticated;
grant all on public.guest_groups to service_role;
alter table public.guest_groups enable row level security;

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  first_name text not null,
  last_name text not null default '',
  email text,
  phone text,
  company text,
  job_title text,
  group_id uuid references public.guest_groups on delete set null,
  rsvp_status public.rsvp_status not null default 'pending',
  vip_status boolean not null default false,
  plus_ones integer not null default 0,
  dietary_requirements text,
  accessibility_requirements text,
  notes text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.guests to authenticated;
grant all on public.guests to service_role;
alter table public.guests enable row level security;
create trigger guests_updated before update on public.guests for each row execute function public.set_updated_at();
create index guests_event_idx on public.guests(event_id);

create table public.guest_relationships (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests on delete cascade,
  related_guest_id uuid not null references public.guests on delete cascade,
  relationship_type text not null default 'family',
  seating_preference public.seating_preference not null default 'prefer_together',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.guest_relationships to authenticated;
grant all on public.guest_relationships to service_role;
alter table public.guest_relationships enable row level security;

create table public.seating_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  guest_id uuid not null references public.guests on delete cascade unique,
  table_id uuid not null references public.event_tables on delete cascade,
  seat_id uuid references public.seats on delete set null unique,
  assigned_at timestamptz not null default now()
);
grant select, insert, update, delete on public.seating_assignments to authenticated;
grant all on public.seating_assignments to service_role;
alter table public.seating_assignments enable row level security;

-- ============ DOCS / PDFS / QR ============
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  event_id uuid references public.events on delete cascade,
  name text not null,
  description text,
  file_url text not null,
  file_type text,
  file_size bigint not null default 0,
  category text not null default 'general',
  uploaded_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;

create table public.pdf_generations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  event_id uuid references public.events on delete cascade,
  type text not null,
  file_url text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pdf_generations to authenticated;
grant all on public.pdf_generations to service_role;
alter table public.pdf_generations enable row level security;

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  guest_id uuid references public.guests on delete cascade,
  type text not null default 'guest',
  token text not null unique default encode(gen_random_bytes(18),'hex'),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.qr_codes to authenticated;
grant all on public.qr_codes to service_role;
alter table public.qr_codes enable row level security;

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  guest_id uuid not null references public.guests on delete cascade unique,
  checked_in_by uuid references auth.users on delete set null,
  method text not null default 'manual',
  checked_in_at timestamptz not null default now()
);
grant select, insert, update, delete on public.check_ins to authenticated;
grant all on public.check_ins to service_role;
alter table public.check_ins enable row level security;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  guest_id uuid not null references public.guests on delete cascade,
  token text not null unique default encode(gen_random_bytes(18),'hex'),
  message text,
  status public.invitation_status not null default 'draft',
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;

create table public.communications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  title text not null,
  message text not null,
  audience text not null default 'all',
  channel text not null default 'email',
  status text not null default 'draft',
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.communications to authenticated;
grant all on public.communications to service_role;
alter table public.communications enable row level security;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  message text,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  user_id uuid references auth.users on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;

-- ============ POLICIES ============
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile write" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "member orgs read" on public.organizations for select to authenticated using (public.is_org_member(id));
create policy "create org" on public.organizations for insert to authenticated with check (true);
create policy "owner org update" on public.organizations for update to authenticated using (public.has_org_role(id,'owner')) with check (public.has_org_role(id,'owner'));
create policy "owner org delete" on public.organizations for delete to authenticated using (public.has_org_role(id,'owner'));

create policy "members read" on public.organization_members for select to authenticated using (public.is_org_member(organization_id));
create policy "self join" on public.organization_members for insert to authenticated with check (user_id = auth.uid() or public.has_org_role(organization_id,'owner'));
create policy "owner manages members" on public.organization_members for update to authenticated using (public.has_org_role(organization_id,'owner'));
create policy "owner removes members" on public.organization_members for delete to authenticated using (public.has_org_role(organization_id,'owner') or user_id = auth.uid());

create policy "org venues" on public.venues for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "org rooms" on public.rooms for all to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and public.is_org_member(v.organization_id)))
  with check (exists (select 1 from public.venues v where v.id = venue_id and public.is_org_member(v.organization_id)));
create policy "org events" on public.events for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "event floor plans" on public.floor_plans for all to authenticated using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "event tables" on public.event_tables for all to authenticated using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "plan objects" on public.floor_plan_objects for all to authenticated
  using (exists (select 1 from public.floor_plans f where f.id = floor_plan_id and public.can_access_event(f.event_id)))
  with check (exists (select 1 from public.floor_plans f where f.id = floor_plan_id and public.can_access_event(f.event_id)));
create policy "event seats" on public.seats for all to authenticated
  using (exists (select 1 from public.event_tables t where t.id = table_id and public.can_access_event(t.event_id)))
  with check (exists (select 1 from public.event_tables t where t.id = table_id and public.can_access_event(t.event_id)));
create policy "event guest groups" on public.guest_groups for all to authenticated using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "event guests" on public.guests for all to authenticated using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "guest rels" on public.guest_relationships for all to authenticated
  using (exists (select 1 from public.guests g where g.id = guest_id and public.can_access_event(g.event_id)))
  with check (exists (select 1 from public.guests g where g.id = guest_id and public.can_access_event(g.event_id)));
create policy "event seating" on public.seating_assignments for all to authenticated using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "org documents" on public.documents for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "org pdfs" on public.pdf_generations for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "event qr" on public.qr_codes for all to authenticated using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "event checkins" on public.check_ins for all to authenticated using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "event invitations" on public.invitations for all to authenticated using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "event comms" on public.communications for all to authenticated using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "own notifications" on public.notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "org audit read" on public.audit_logs for select to authenticated using (public.is_org_member(organization_id));
create policy "org audit write" on public.audit_logs for insert to authenticated with check (public.is_org_member(organization_id));

-- ============ REALTIME ============
alter publication supabase_realtime add table public.check_ins;
alter publication supabase_realtime add table public.guests;
alter publication supabase_realtime add table public.seating_assignments;
alter publication supabase_realtime add table public.notifications;

-- ============ SAMPLE DATA ============
insert into public.organizations (id, name, slug, primary_color, plan, is_demo) values
  ('11111111-1111-1111-1111-111111111111','Nexa Events Group','nexa-events-group','#f5b14a','business', true);

insert into public.venues (id, organization_id, name, address, description, capacity) values
  ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111111','The Grand Atrium','14 Kenyatta Ave, Nairobi','Flagship ballroom with mezzanine gallery.', 600),
  ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111111','Lakeside Pavilion','Naivasha Road, Nakuru','Open-air pavilion overlooking the lake.', 240),
  ('22222222-2222-2222-2222-222222222203','11111111-1111-1111-1111-111111111111','Innovation Hall B','Westlands Tech Park, Nairobi','Conference hall with tiered seating.', 1200);

insert into public.rooms (venue_id, name, capacity) values
  ('22222222-2222-2222-2222-222222222201','Main Hall', 480),
  ('22222222-2222-2222-2222-222222222201','Mezzanine', 120),
  ('22222222-2222-2222-2222-222222222202','Garden Terrace', 220),
  ('22222222-2222-2222-2222-222222222203','Auditorium', 900);

insert into public.events (id, organization_id, name, description, category, event_date, start_time, end_time, venue_id, capacity, status) values
  ('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111111','Annual Corporate Gala','Black-tie awards dinner for partners and top clients.','gala', current_date + 12, '18:30','23:30','22222222-2222-2222-2222-222222222201', 480,'live'),
  ('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111111','Sarah & David Wedding','Garden ceremony followed by seated dinner.','wedding', current_date + 34, '15:00','22:00','22222222-2222-2222-2222-222222222202', 180,'upcoming'),
  ('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111111','Technology Innovation Conference','Two-track conference with keynote and workshops.','conference', current_date + 58, '08:30','17:00','22222222-2222-2222-2222-222222222203', 1200,'draft');

insert into public.floor_plans (id, event_id, name, width, height) values
  ('44444444-4444-4444-4444-444444444401','33333333-3333-3333-3333-333333333301','Main Hall', 1200, 800),
  ('44444444-4444-4444-4444-444444444402','33333333-3333-3333-3333-333333333302','Garden Terrace', 1000, 700);

insert into public.floor_plan_objects (floor_plan_id, label, object_type, position_x, position_y, width, height) values
  ('44444444-4444-4444-4444-444444444401','Stage','stage', 460, 40, 280, 80),
  ('44444444-4444-4444-4444-444444444401','Dance Floor','dance_floor', 500, 380, 200, 160),
  ('44444444-4444-4444-4444-444444444401','Entrance','entrance', 60, 700, 140, 50),
  ('44444444-4444-4444-4444-444444444401','Bar','bar', 980, 620, 160, 70),
  ('44444444-4444-4444-4444-444444444402','Altar','stage', 400, 40, 220, 70);

insert into public.event_tables (id, event_id, floor_plan_id, name, table_number, table_type, capacity, position_x, position_y, width, height)
select
  ('55555555-0000-0000-0000-0000000000' || lpad(n::text,2,'0'))::uuid,
  '33333333-3333-3333-3333-333333333301','44444444-4444-4444-4444-444444444401',
  'Table ' || n, n, 'round', 8,
  120 + ((n-1) % 4) * 250, 160 + ((n-1) / 4) * 210, 140, 140
from generate_series(1,8) n;

insert into public.event_tables (id, event_id, floor_plan_id, name, table_number, table_type, capacity, position_x, position_y, width, height) values
  ('55555555-0000-0000-0000-0000000000aa','33333333-3333-3333-3333-333333333302','44444444-4444-4444-4444-444444444402','Head Table', 1,'rectangle', 6, 380, 140, 240, 90),
  ('55555555-0000-0000-0000-0000000000ab','33333333-3333-3333-3333-333333333302','44444444-4444-4444-4444-444444444402','Table 2', 2,'round', 8, 180, 340, 140, 140),
  ('55555555-0000-0000-0000-0000000000ac','33333333-3333-3333-3333-333333333302','44444444-4444-4444-4444-444444444402','Table 3', 3,'round', 8, 480, 340, 140, 140);

insert into public.seats (table_id, seat_number)
select t.id, s from public.event_tables t, generate_series(1, t.capacity) s;

insert into public.guest_groups (id, event_id, name, type) values
  ('66666666-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333301','Board of Directors','vip'),
  ('66666666-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333301','Acme Industries','company'),
  ('66666666-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333302','Otieno Family','family'),
  ('66666666-0000-0000-0000-000000000004','33333333-3333-3333-3333-333333333302','University Friends','friends');

insert into public.guests (id, event_id, first_name, last_name, email, phone, company, job_title, group_id, rsvp_status, vip_status, dietary_requirements) values
  ('77777777-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333301','Amara','Kessler','amara.kessler@nexa.io','+254700000001','Nexa Events Group','Chief Executive','66666666-0000-0000-0000-000000000001','confirmed', true,'Vegetarian'),
  ('77777777-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333301','Daniel','Mwangi','d.mwangi@acme.co','+254700000002','Acme Industries','Head of Partnerships','66666666-0000-0000-0000-000000000002','confirmed', false, null),
  ('77777777-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333301','Priya','Raman','priya@lumina.dev','+254700000003','Lumina Labs','CTO','66666666-0000-0000-0000-000000000001','confirmed', true,'Nut allergy'),
  ('77777777-0000-0000-0000-000000000004','33333333-3333-3333-3333-333333333301','Tomas','Almeida','tomas@orbital.pt','+254700000004','Orbital Group','Investor',null,'pending', false, null),
  ('77777777-0000-0000-0000-000000000005','33333333-3333-3333-3333-333333333301','Fatima','Noor','fatima.noor@acme.co','+254700000005','Acme Industries','Finance Director','66666666-0000-0000-0000-000000000002','confirmed', false,'Halal'),
  ('77777777-0000-0000-0000-000000000006','33333333-3333-3333-3333-333333333301','John','Karanja','john.k@meridian.co.ke','+254700000006','Meridian Bank','Regional Manager',null,'confirmed', false, null),
  ('77777777-0000-0000-0000-000000000007','33333333-3333-3333-3333-333333333301','Peter','Ngugi','peter.n@meridian.co.ke','+254700000007','Meridian Bank','Risk Lead',null,'declined', false, null),
  ('77777777-0000-0000-0000-000000000008','33333333-3333-3333-3333-333333333301','Sofia','Lindqvist','sofia@nordicvc.se','+254700000008','Nordic VC','Partner',null,'confirmed', true,'Gluten free'),
  ('77777777-0000-0000-0000-000000000009','33333333-3333-3333-3333-333333333301','Kwame','Boateng','kwame@ashantiholdings.gh','+254700000009','Ashanti Holdings','Director',null,'confirmed', false, null),
  ('77777777-0000-0000-0000-000000000010','33333333-3333-3333-3333-333333333301','Lena','Fischer','lena.fischer@bauwerk.de','+254700000010','Bauwerk AG','VP Operations',null,'maybe', false, null),
  ('77777777-0000-0000-0000-000000000011','33333333-3333-3333-3333-333333333301','Mercy','Wanjiru','mercy.w@acme.co','+254700000011','Acme Industries','Brand Lead','66666666-0000-0000-0000-000000000002','confirmed', false,'Vegan'),
  ('77777777-0000-0000-0000-000000000012','33333333-3333-3333-3333-333333333301','Hiroshi','Tanaka','h.tanaka@sakura.jp','+254700000012','Sakura Systems','Managing Director',null,'confirmed', true, null),
  ('77777777-0000-0000-0000-000000000013','33333333-3333-3333-3333-333333333301','Grace','Achieng','grace.a@uzuri.co.ke','+254700000013','Uzuri Foods','Founder',null,'confirmed', false, null),
  ('77777777-0000-0000-0000-000000000014','33333333-3333-3333-3333-333333333301','Marcus','Obrien','marcus@harbourpr.ie','+254700000014','Harbour PR','Account Director',null,'pending', false, null),
  ('77777777-0000-0000-0000-000000000015','33333333-3333-3333-3333-333333333301','Zainab','Hassan','zainab@coastalgroup.ke','+254700000015','Coastal Group','COO',null,'confirmed', false,'Halal'),
  ('77777777-0000-0000-0000-000000000016','33333333-3333-3333-3333-333333333301','Eric','Ndlovu','eric.n@savanna.co.za','+254700000016','Savanna Media','Editor',null,'confirmed', false, null),
  ('77777777-0000-0000-0000-000000000017','33333333-3333-3333-3333-333333333302','Sarah','Otieno','sarah.otieno@mail.com','+254711000001',null,null,'66666666-0000-0000-0000-000000000003','confirmed', true, null),
  ('77777777-0000-0000-0000-000000000018','33333333-3333-3333-3333-333333333302','David','Otieno','david.otieno@mail.com','+254711000002',null,null,'66666666-0000-0000-0000-000000000003','confirmed', true, null),
  ('77777777-0000-0000-0000-000000000019','33333333-3333-3333-3333-333333333302','Ruth','Otieno','ruth.o@mail.com','+254711000003',null,null,'66666666-0000-0000-0000-000000000003','confirmed', false,'Diabetic'),
  ('77777777-0000-0000-0000-000000000020','33333333-3333-3333-3333-333333333302','Brian','Kimani','brian.k@mail.com','+254711000004',null,null,'66666666-0000-0000-0000-000000000004','confirmed', false, null),
  ('77777777-0000-0000-0000-000000000021','33333333-3333-3333-3333-333333333302','Nadia','Perez','nadia.p@mail.com','+254711000005',null,null,'66666666-0000-0000-0000-000000000004','maybe', false,'Vegetarian'),
  ('77777777-0000-0000-0000-000000000022','33333333-3333-3333-3333-333333333302','Leo','Van Dijk','leo.vd@mail.com','+254711000006',null,null,null,'pending', false, null),
  ('77777777-0000-0000-0000-000000000023','33333333-3333-3333-3333-333333333303','Ada','Nwosu','ada@devforge.ng','+254722000001','DevForge','Engineering Lead',null,'confirmed', false, null),
  ('77777777-0000-0000-0000-000000000024','33333333-3333-3333-3333-333333333303','Sam','Whitfield','sam@cloudpeak.io','+254722000002','CloudPeak','Solutions Architect',null,'pending', false, null);

insert into public.guest_relationships (guest_id, related_guest_id, relationship_type, seating_preference) values
  ('77777777-0000-0000-0000-000000000017','77777777-0000-0000-0000-000000000018','couple','must_together'),
  ('77777777-0000-0000-0000-000000000006','77777777-0000-0000-0000-000000000007','colleague','must_apart'),
  ('77777777-0000-0000-0000-000000000002','77777777-0000-0000-0000-000000000005','colleague','prefer_together');

with ranked as (
  select g.id as guest_id, row_number() over (order by g.id) - 1 as rn
  from public.guests g where g.event_id = '33333333-3333-3333-3333-333333333301'
), tbl as (
  select t.id as table_id, row_number() over (order by t.table_number) - 1 as tn
  from public.event_tables t where t.event_id = '33333333-3333-3333-3333-333333333301'
)
insert into public.seating_assignments (event_id, guest_id, table_id, seat_id)
select '33333333-3333-3333-3333-333333333301', r.guest_id, t.table_id,
  (select s.id from public.seats s where s.table_id = t.table_id and s.seat_number = (r.rn / 4) + 1 limit 1)
from ranked r join tbl t on t.tn = (r.rn % 4);

insert into public.check_ins (event_id, guest_id, method, checked_in_at)
select '33333333-3333-3333-3333-333333333301', id, 'qr', now() - (random() * interval '90 minutes')
from public.guests
where event_id = '33333333-3333-3333-3333-333333333301' and rsvp_status = 'confirmed'
order by id limit 9;

insert into public.qr_codes (event_id, guest_id, type)
select event_id, id, 'guest' from public.guests;

insert into public.invitations (event_id, guest_id, status, sent_at, message)
select event_id, id, 'sent', now() - interval '9 days', 'We would be delighted to host you.'
from public.guests where event_id in ('33333333-3333-3333-3333-333333333301','33333333-3333-3333-3333-333333333302');

insert into public.communications (event_id, title, message, audience, channel, status) values
  ('33333333-3333-3333-3333-333333333301','Parking & arrival details','Valet parking opens at 17:45 on the north entrance.','all','email','sent'),
  ('33333333-3333-3333-3333-333333333301','VIP reception','Join us for a private reception at 18:00 in the Mezzanine.','vip','email','sent'),
  ('33333333-3333-3333-3333-333333333302','Dress code reminder','Garden formal — heels not recommended on the lawn.','all','sms','draft');

insert into public.documents (organization_id, event_id, name, description, file_url, file_type, file_size, category) values
  ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333301','Grand Atrium floor plan','Architect drawing of the main hall.','#','application/pdf', 842000,'floor_plan'),
  ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333301','Gala running order','Minute-by-minute programme.','#','application/pdf', 214000,'program'),
  ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333302','Catering menu','Three-course seated dinner menu.','#','application/pdf', 156000,'menu');
