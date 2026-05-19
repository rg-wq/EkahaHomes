-- ============================================================================
-- StayOps — initial schema
-- Run this first in Supabase Dashboard > SQL Editor.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type user_role as enum ('owner', 'manager', 'staff');
create type hk_job_status as enum ('assigned', 'in_progress', 'submitted', 'approved', 'rejected');
create type tracking_model as enum ('count', 'par', 'trigger');
create type advance_mode as enum ('cash', 'upi', 'bank');
create type expense_status as enum ('pending', 'approved', 'rejected');
create type expense_category as enum (
  'supplies', 'travel', 'food', 'maintenance', 'utilities', 'laundry', 'staff', 'other'
);
create type ledger_event_type as enum (
  'staff_use', 'topup_room', 'laundry_return', 'laundry_shortfall',
  'new_stock', 'replace_trigger', 'par_refill', 'adjustment'
);
create type inventory_scope as enum ('cupboard', 'room');

-- ----------------------------------------------------------------------------
-- profiles — extends auth.users with role + display info
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'staff',
  full_name text not null,
  phone text unique,
  email text,
  property_ids text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role) where active;
create index idx_profiles_phone on public.profiles(phone);

-- ----------------------------------------------------------------------------
-- properties — the 3 Ekaha properties (seeded)
-- ----------------------------------------------------------------------------
create table public.properties (
  id text primary key,
  name text not null,
  location text not null,
  lat double precision not null,
  lng double precision not null,
  geofence_meters integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- rooms — physical rooms within a property
-- ----------------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id) on delete cascade,
  name text not null,
  room_type text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (property_id, name)
);

-- ----------------------------------------------------------------------------
-- suppliers — vendors for inventory + laundry (laundry deferred to later slice)
-- ----------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  contact_name text,
  contact_phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- templates — Module 4: checklist templates authored by owner
-- ----------------------------------------------------------------------------
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  property_id text references public.properties(id) on delete cascade,
  room_type text not null,
  -- tasks: [{ task_id, name, instructions, zone, mandatory, photo_required,
  --          sequence, estimated_minutes, linked_inventory_item }]
  tasks jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_templates_property on public.templates(property_id) where active;

-- ----------------------------------------------------------------------------
-- hk_jobs — Module 5: housekeeping jobs assigned to staff
-- ----------------------------------------------------------------------------
create table public.hk_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id text,
  property_id text not null references public.properties(id),
  room_id uuid references public.rooms(id) on delete set null,
  template_id uuid not null references public.templates(id),
  staff_id uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  -- gps_check_in: { lat, lng, accuracy_m, matched: bool, distance_m }
  gps_check_in jsonb,
  -- tasks: [{ task_id, done, photo_url, done_at, flagged, qc_note }]
  tasks jsonb not null default '[]'::jsonb,
  status hk_job_status not null default 'assigned',
  qc_notes text,
  qc_by uuid references public.profiles(id),
  qc_at timestamptz,
  flagged_fast boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_hk_jobs_staff on public.hk_jobs(staff_id, status);
create index idx_hk_jobs_property on public.hk_jobs(property_id, status);
create index idx_hk_jobs_qc on public.hk_jobs(status) where status = 'submitted';

-- ----------------------------------------------------------------------------
-- staff_attendance — Module 11: GPS check-in log
-- ----------------------------------------------------------------------------
create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  property_id text not null references public.properties(id),
  checked_in_at timestamptz not null default now(),
  -- gps: { lat, lng, accuracy_m }
  gps jsonb not null,
  distance_m double precision,
  within_geofence boolean not null,
  hk_job_id uuid references public.hk_jobs(id),
  created_at timestamptz not null default now()
);

create index idx_attendance_staff_date on public.staff_attendance(staff_id, checked_in_at desc);
create index idx_attendance_property_date on public.staff_attendance(property_id, checked_in_at desc);

-- ----------------------------------------------------------------------------
-- inventory_items — Module 8: per-property item registry (3 tracking models)
-- ----------------------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id) on delete cascade,
  name text not null,
  tracking_model tracking_model not null,
  cupboard_qty integer not null default 0,
  room_qty integer not null default 0,
  reorder_threshold integer not null default 0,
  reorder_qty integer not null default 0,
  unit text not null default 'unit',
  linked_supplier_id uuid references public.suppliers(id),
  replace_after_n integer,
  refill_count integer not null default 0,
  last_updated timestamptz not null default now(),
  last_updated_by uuid references public.profiles(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (property_id, name)
);

create index idx_inventory_property on public.inventory_items(property_id) where active;

-- ----------------------------------------------------------------------------
-- inventory_ledger — Module 8: append-only event log; updates qty via trigger
-- ----------------------------------------------------------------------------
create table public.inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  event_type ledger_event_type not null,
  qty integer not null,
  scope inventory_scope not null default 'cupboard',
  related_id text,
  related_type text,
  performed_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create index idx_ledger_item_date on public.inventory_ledger(item_id, created_at desc);
create index idx_ledger_property_date on public.inventory_ledger(property_id, created_at desc);

-- ----------------------------------------------------------------------------
-- expenses — Module 9 minimal stub (UI deferred; used for staff_expense wire)
-- ----------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id),
  amount numeric(10, 2) not null check (amount > 0),
  category expense_category not null,
  description text,
  receipt_url text,
  logged_by uuid references public.profiles(id),
  logged_at timestamptz not null default now(),
  spent_at date not null default current_date,
  booking_id text,
  source text not null default 'manual' check (source in ('manual', 'staff_expense')),
  staff_expense_id uuid,
  created_at timestamptz not null default now()
);

create index idx_expenses_property_date on public.expenses(property_id, spent_at desc);

-- ----------------------------------------------------------------------------
-- staff_advances — Module 13: cash/UPI advances given to staff
-- ----------------------------------------------------------------------------
create table public.staff_advances (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(10, 2) not null check (amount > 0),
  mode advance_mode not null default 'cash',
  given_by uuid not null references public.profiles(id),
  given_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index idx_advances_staff_date on public.staff_advances(staff_id, given_at desc);

-- ----------------------------------------------------------------------------
-- staff_expenses — Module 13: expenses logged by staff against their advance
-- ----------------------------------------------------------------------------
create table public.staff_expenses (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(10, 2) not null check (amount > 0),
  category expense_category not null,
  description text,
  receipt_url text,
  property_id text references public.properties(id),
  spent_at date not null default current_date,
  logged_at timestamptz not null default now(),
  status expense_status not null default 'pending',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  reject_reason text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_staff_expenses_staff_date on public.staff_expenses(staff_id, spent_at desc);
create index idx_staff_expenses_pending on public.staff_expenses(logged_at) where status = 'pending';

-- Now wire the FK back from expenses → staff_expenses (had to defer due to creation order)
alter table public.expenses
  add constraint expenses_staff_expense_fk
  foreign key (staff_expense_id) references public.staff_expenses(id) on delete set null;
