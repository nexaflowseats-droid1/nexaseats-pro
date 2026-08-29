create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 255),
  company text check (char_length(company) <= 120),
  message text not null check (char_length(message) between 10 and 1500),
  created_at timestamptz not null default now()
);

grant insert on public.contact_messages to anon, authenticated;
grant all on public.contact_messages to service_role;

alter table public.contact_messages enable row level security;

create policy "anyone can submit contact messages"
  on public.contact_messages for insert
  to anon, authenticated
  with check (true);