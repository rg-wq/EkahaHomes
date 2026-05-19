-- ============================================================================
-- StayOps — derived views for fast reads
-- Run after 20260519000003_rls.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- staff_ledger_view — per-staff running balance (Module 13 main read)
-- balance = total advances - total approved expenses
-- pending_amount = sum of expenses awaiting manager approval
-- ----------------------------------------------------------------------------
create or replace view public.staff_ledger_view as
with adv as (
  select staff_id, sum(amount) as total_advances, max(given_at) as last_advance_at
  from public.staff_advances
  group by staff_id
),
exp_approved as (
  select staff_id, sum(amount) as total_approved
  from public.staff_expenses
  where status = 'approved'
  group by staff_id
),
exp_pending as (
  select staff_id, sum(amount) as total_pending, count(*) as pending_count
  from public.staff_expenses
  where status = 'pending'
  group by staff_id
)
select
  p.id as staff_id,
  p.full_name,
  p.phone,
  p.email,
  coalesce(adv.total_advances, 0) as total_advances,
  coalesce(exp_approved.total_approved, 0) as total_approved_expenses,
  coalesce(exp_pending.total_pending, 0) as pending_amount,
  coalesce(exp_pending.pending_count, 0) as pending_count,
  coalesce(adv.total_advances, 0) - coalesce(exp_approved.total_approved, 0) as balance,
  adv.last_advance_at
from public.profiles p
left join adv          on adv.staff_id = p.id
left join exp_approved on exp_approved.staff_id = p.id
left join exp_pending  on exp_pending.staff_id = p.id
where p.role = 'staff' and p.active;

-- Views inherit RLS from underlying tables, so manager+owner see all rows;
-- staff users will see only their own row (because staff_advances + staff_expenses
-- RLS limits select to staff_id = auth.uid() for the staff role).

-- ----------------------------------------------------------------------------
-- pending_qc_jobs_view — manager's QC queue (Module 6)
-- ----------------------------------------------------------------------------
create or replace view public.pending_qc_jobs_view as
select
  j.id,
  j.property_id,
  p.name as property_name,
  j.room_id,
  r.name as room_name,
  j.staff_id,
  s.full_name as staff_name,
  j.completed_at,
  j.flagged_fast,
  jsonb_array_length(j.tasks) as task_count,
  (
    select count(*)
    from jsonb_array_elements(j.tasks) t
    where (t->>'photo_url') is not null
  ) as photo_count
from public.hk_jobs j
join public.properties p on p.id = j.property_id
left join public.rooms r on r.id = j.room_id
left join public.profiles s on s.id = j.staff_id
where j.status = 'submitted'
order by j.flagged_fast desc, j.completed_at asc;

-- ----------------------------------------------------------------------------
-- inventory_status_view — items at/below reorder threshold (Module 8 alert)
-- ----------------------------------------------------------------------------
create or replace view public.inventory_status_view as
select
  i.*,
  (i.cupboard_qty <= i.reorder_threshold) as needs_reorder,
  (i.cupboard_qty + i.room_qty) as total_on_hand
from public.inventory_items i
where i.active;
