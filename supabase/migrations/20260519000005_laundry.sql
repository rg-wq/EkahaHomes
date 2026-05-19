-- ============================================================================
-- StayOps — Module 7 (Laundry challan) minimal v1
-- No vendor OTP — staff handles both sides, witnesses vendor verbally.
-- Idempotent: safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enum (idempotent via DO block)
-- ----------------------------------------------------------------------------
do $$ begin
  create type challan_status as enum (
    'in_laundry',
    'closed',
    'disputed'
  );
exception
  when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- Sequential challan numbers: CH-2026-001, CH-2026-002, etc.
-- ----------------------------------------------------------------------------
create sequence if not exists challan_number_seq start with 1;

create or replace function public.gen_challan_number()
returns text
language sql
as $$
  select 'CH-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('challan_number_seq')::text, 3, '0');
$$;

-- ----------------------------------------------------------------------------
-- challans table
-- ----------------------------------------------------------------------------
create table if not exists public.challans (
  id uuid primary key default gen_random_uuid(),
  challan_number text not null unique default public.gen_challan_number(),
  property_id text not null references public.properties(id) on delete restrict,

  vendor_name text not null,
  vendor_phone text,

  status challan_status not null default 'in_laundry',

  pickup_items jsonb not null default '[]'::jsonb,
  pickup_at timestamptz not null default now(),
  pickup_staff_id uuid references public.profiles(id),
  pickup_notes text,
  vendor_acknowledged boolean not null default false,

  return_items jsonb not null default '[]'::jsonb,
  return_at timestamptz,
  return_staff_id uuid references public.profiles(id),
  return_notes text,
  defect_photos jsonb not null default '[]'::jsonb,

  closed_at timestamptz,
  total_shortfall_qty integer not null default 0,
  total_defect_qty integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_challans_property_status on public.challans(property_id, status);
create index if not exists idx_challans_pickup_at on public.challans(pickup_at desc);
create index if not exists idx_challans_open on public.challans(status) where status = 'in_laundry';

drop trigger if exists trg_challans_updated_at on public.challans;
create trigger trg_challans_updated_at
  before update on public.challans
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Inventory wire — fires when challan closes (return is finalized).
-- ----------------------------------------------------------------------------
create or replace function public.apply_laundry_return()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  total_short integer := 0;
  total_def integer := 0;
begin
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status is distinct from 'closed') then
    for item in select * from jsonb_array_elements(new.return_items)
    loop
      if (item->>'returned_qty')::int > 0 and (item->>'item_id') is not null then
        insert into public.inventory_ledger (
          property_id, item_id, event_type, qty, scope,
          related_id, related_type, performed_by, note
        ) values (
          new.property_id,
          (item->>'item_id')::uuid,
          'laundry_return',
          (item->>'returned_qty')::int,
          'cupboard',
          new.id::text,
          'challan',
          new.return_staff_id,
          'Returned in ' || new.challan_number
        );
      end if;

      if coalesce((item->>'shortfall')::int, 0) > 0 then
        total_short := total_short + (item->>'shortfall')::int;
        if (item->>'item_id') is not null then
          insert into public.inventory_ledger (
            property_id, item_id, event_type, qty, scope,
            related_id, related_type, performed_by, note
          ) values (
            new.property_id,
            (item->>'item_id')::uuid,
            'laundry_shortfall',
            0,
            'cupboard',
            new.id::text,
            'challan',
            new.return_staff_id,
            'Shortfall in ' || new.challan_number || ': missing ' || (item->>'shortfall')
          );
        end if;
      end if;

      total_def := total_def + coalesce((item->>'defect_qty')::int, 0);
    end loop;

    new.total_shortfall_qty := total_short;
    new.total_defect_qty := total_def;
    if new.closed_at is null then
      new.closed_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_laundry_return on public.challans;
create trigger trg_apply_laundry_return
  before insert or update on public.challans
  for each row execute function public.apply_laundry_return();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.challans enable row level security;

drop policy if exists "challans: read all auth" on public.challans;
create policy "challans: read all auth"
  on public.challans for select
  to authenticated
  using (true);

drop policy if exists "challans: staff or mgr+ inserts" on public.challans;
create policy "challans: staff or mgr+ inserts"
  on public.challans for insert
  to authenticated
  with check (pickup_staff_id = auth.uid() or public.is_owner_or_manager());

drop policy if exists "challans: assigned staff or mgr+ updates" on public.challans;
create policy "challans: assigned staff or mgr+ updates"
  on public.challans for update
  to authenticated
  using (
    pickup_staff_id = auth.uid()
    or return_staff_id = auth.uid()
    or public.is_owner_or_manager()
  )
  with check (
    pickup_staff_id = auth.uid()
    or return_staff_id = auth.uid()
    or public.is_owner_or_manager()
  );

drop policy if exists "challans: owner deletes" on public.challans;
create policy "challans: owner deletes"
  on public.challans for delete
  to authenticated
  using (public.is_owner());
