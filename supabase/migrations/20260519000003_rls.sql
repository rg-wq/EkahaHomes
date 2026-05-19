-- ============================================================================
-- StayOps — Row Level Security policies
-- Run after 20260519000002_helpers_and_triggers.sql.
-- Enforces owner > manager > staff hierarchy per spec.
-- ============================================================================

-- Enable RLS on all tables
alter table public.profiles          enable row level security;
alter table public.properties        enable row level security;
alter table public.rooms             enable row level security;
alter table public.suppliers         enable row level security;
alter table public.templates         enable row level security;
alter table public.hk_jobs           enable row level security;
alter table public.staff_attendance  enable row level security;
alter table public.inventory_items   enable row level security;
alter table public.inventory_ledger  enable row level security;
alter table public.expenses          enable row level security;
alter table public.staff_advances    enable row level security;
alter table public.staff_expenses    enable row level security;

-- ----------------------------------------------------------------------------
-- profiles
-- Self can read+update own row. Owner/manager can read all; only owner can update others.
-- ----------------------------------------------------------------------------
create policy "profiles: read own or any if mgr+"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_owner_or_manager());

create policy "profiles: update own (non-role fields)"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles: owner can update any"
  on public.profiles for update
  to authenticated
  using (public.is_owner());

-- INSERT into profiles is handled by handle_new_user trigger; deny direct.

-- ----------------------------------------------------------------------------
-- properties — read all auth; write owner only
-- ----------------------------------------------------------------------------
create policy "properties: read all authenticated"
  on public.properties for select
  to authenticated
  using (true);

create policy "properties: owner writes"
  on public.properties for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- ----------------------------------------------------------------------------
-- rooms — read all auth; write owner only
-- ----------------------------------------------------------------------------
create policy "rooms: read all authenticated"
  on public.rooms for select
  to authenticated
  using (true);

create policy "rooms: owner writes"
  on public.rooms for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- ----------------------------------------------------------------------------
-- suppliers — read all auth; write manager+owner
-- ----------------------------------------------------------------------------
create policy "suppliers: read all authenticated"
  on public.suppliers for select
  to authenticated
  using (true);

create policy "suppliers: mgr+ writes"
  on public.suppliers for all
  to authenticated
  using (public.is_owner_or_manager())
  with check (public.is_owner_or_manager());

-- ----------------------------------------------------------------------------
-- templates — read all auth; write owner only
-- ----------------------------------------------------------------------------
create policy "templates: read all authenticated"
  on public.templates for select
  to authenticated
  using (true);

create policy "templates: owner writes"
  on public.templates for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- ----------------------------------------------------------------------------
-- hk_jobs
-- Staff: read+update jobs assigned to them (only update tasks/status/started_at/completed_at/gps).
-- Manager+Owner: full access.
-- ----------------------------------------------------------------------------
create policy "hk_jobs: staff reads own; mgr+ reads all"
  on public.hk_jobs for select
  to authenticated
  using (staff_id = auth.uid() or public.is_owner_or_manager());

create policy "hk_jobs: mgr+ inserts"
  on public.hk_jobs for insert
  to authenticated
  with check (public.is_owner_or_manager());

create policy "hk_jobs: staff updates own"
  on public.hk_jobs for update
  to authenticated
  using (staff_id = auth.uid())
  with check (staff_id = auth.uid());

create policy "hk_jobs: mgr+ updates any"
  on public.hk_jobs for update
  to authenticated
  using (public.is_owner_or_manager())
  with check (public.is_owner_or_manager());

create policy "hk_jobs: owner deletes"
  on public.hk_jobs for delete
  to authenticated
  using (public.is_owner());

-- ----------------------------------------------------------------------------
-- staff_attendance
-- Staff inserts + reads own. Manager+Owner read all.
-- ----------------------------------------------------------------------------
create policy "attendance: staff reads own; mgr+ reads all"
  on public.staff_attendance for select
  to authenticated
  using (staff_id = auth.uid() or public.is_owner_or_manager());

create policy "attendance: staff inserts own"
  on public.staff_attendance for insert
  to authenticated
  with check (staff_id = auth.uid());

-- ----------------------------------------------------------------------------
-- inventory_items
-- Read: all authenticated (staff need to see what to top up).
-- Write: manager+owner. (Staff don't mutate items directly — they insert ledger rows
--        and the trigger updates qty; ledger-insert policy below allows this.)
-- ----------------------------------------------------------------------------
create policy "inventory_items: read all auth"
  on public.inventory_items for select
  to authenticated
  using (true);

create policy "inventory_items: mgr+ writes"
  on public.inventory_items for all
  to authenticated
  using (public.is_owner_or_manager())
  with check (public.is_owner_or_manager());

-- ----------------------------------------------------------------------------
-- inventory_ledger
-- Read: manager+owner (audit log).
-- Insert: any authenticated user (staff actions log here; performed_by must = self).
-- No updates/deletes (append-only).
-- ----------------------------------------------------------------------------
create policy "ledger: mgr+ reads"
  on public.inventory_ledger for select
  to authenticated
  using (public.is_owner_or_manager());

create policy "ledger: auth inserts (self attributed)"
  on public.inventory_ledger for insert
  to authenticated
  with check (performed_by = auth.uid());

-- ----------------------------------------------------------------------------
-- expenses — manager+owner only (no staff visibility into property P&L)
-- ----------------------------------------------------------------------------
create policy "expenses: mgr+ reads"
  on public.expenses for select
  to authenticated
  using (public.is_owner_or_manager());

create policy "expenses: mgr+ writes"
  on public.expenses for all
  to authenticated
  using (public.is_owner_or_manager())
  with check (public.is_owner_or_manager());

-- ----------------------------------------------------------------------------
-- staff_advances
-- Staff: read own. Manager+Owner: full access (give advances).
-- ----------------------------------------------------------------------------
create policy "advances: staff reads own; mgr+ reads all"
  on public.staff_advances for select
  to authenticated
  using (staff_id = auth.uid() or public.is_owner_or_manager());

create policy "advances: mgr+ writes"
  on public.staff_advances for all
  to authenticated
  using (public.is_owner_or_manager())
  with check (public.is_owner_or_manager());

-- ----------------------------------------------------------------------------
-- staff_expenses
-- Staff: insert own + read own + edit own while pending.
-- Manager+Owner: read all + approve/reject (update status).
-- Owner: delete.
-- ----------------------------------------------------------------------------
create policy "staff_expenses: staff reads own; mgr+ reads all"
  on public.staff_expenses for select
  to authenticated
  using (staff_id = auth.uid() or public.is_owner_or_manager());

create policy "staff_expenses: staff inserts own"
  on public.staff_expenses for insert
  to authenticated
  with check (staff_id = auth.uid() and status = 'pending');

create policy "staff_expenses: staff edits own while pending"
  on public.staff_expenses for update
  to authenticated
  using (staff_id = auth.uid() and status = 'pending')
  with check (staff_id = auth.uid() and status = 'pending');

create policy "staff_expenses: mgr+ updates any"
  on public.staff_expenses for update
  to authenticated
  using (public.is_owner_or_manager())
  with check (public.is_owner_or_manager());

create policy "staff_expenses: owner deletes"
  on public.staff_expenses for delete
  to authenticated
  using (public.is_owner());
