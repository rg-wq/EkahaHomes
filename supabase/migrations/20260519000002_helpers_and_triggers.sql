-- ============================================================================
-- StayOps — helper functions + triggers
-- Run after 20260519000001_schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Role helpers — used by RLS policies
-- ----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'owner' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_owner_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('owner', 'manager') from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ----------------------------------------------------------------------------
-- updated_at — generic trigger fn
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger trg_templates_updated_at
  before update on public.templates
  for each row execute function public.touch_updated_at();

create trigger trg_hk_jobs_updated_at
  before update on public.hk_jobs
  for each row execute function public.touch_updated_at();

create trigger trg_staff_expenses_updated_at
  before update on public.staff_expenses
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- handle_new_user — auto-create a profile row when an auth.user is created.
-- New users default to role='staff' with full_name from raw_user_meta_data.
-- Owner/manager promotion is done by the owner from the user-mgmt UI.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1), 'Staff'),
    new.email,
    new.phone,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- inventory_apply_ledger — on each ledger insert, update item qty.
-- scope='room' affects room_qty; 'cupboard' affects cupboard_qty.
-- ----------------------------------------------------------------------------
create or replace function public.inventory_apply_ledger()
returns trigger
language plpgsql
as $$
begin
  if new.scope = 'room' then
    update public.inventory_items
      set room_qty = room_qty + new.qty,
          last_updated = now(),
          last_updated_by = new.performed_by
      where id = new.item_id;
  else
    update public.inventory_items
      set cupboard_qty = cupboard_qty + new.qty,
          last_updated = now(),
          last_updated_by = new.performed_by
      where id = new.item_id;
  end if;
  return new;
end;
$$;

create trigger trg_inventory_apply_ledger
  after insert on public.inventory_ledger
  for each row execute function public.inventory_apply_ledger();

-- ----------------------------------------------------------------------------
-- staff_expense → property expense auto-wire (Module 13 ↔ Module 9).
-- When status moves to 'approved' → insert matching expenses row.
-- When approved row is later un-approved (back to pending/rejected) → delete it.
-- ----------------------------------------------------------------------------
create or replace function public.sync_staff_expense_to_expenses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id text;
begin
  -- INSERT or UPDATE that moves status to 'approved'
  if (tg_op = 'INSERT' and new.status = 'approved')
     or (tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved') then

    -- Fallback: if staff_expense has no property_id, attribute to first property in staff's property_ids
    v_property_id := new.property_id;
    if v_property_id is null then
      select (property_ids)[1] into v_property_id from public.profiles where id = new.staff_id;
    end if;

    if v_property_id is not null then
      insert into public.expenses (
        property_id, amount, category, description, receipt_url,
        logged_by, spent_at, source, staff_expense_id
      )
      values (
        v_property_id, new.amount, new.category, new.description, new.receipt_url,
        new.approved_by, new.spent_at, 'staff_expense', new.id
      );
    end if;
  end if;

  -- UPDATE that un-approves a previously-approved row → remove the linked expense
  if tg_op = 'UPDATE' and old.status = 'approved' and new.status is distinct from 'approved' then
    delete from public.expenses where staff_expense_id = new.id;
  end if;

  return new;
end;
$$;

create trigger trg_staff_expense_sync
  after insert or update on public.staff_expenses
  for each row execute function public.sync_staff_expense_to_expenses();
