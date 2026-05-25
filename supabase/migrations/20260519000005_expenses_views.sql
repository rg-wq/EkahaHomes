-- ============================================================================
-- StayOps — Module 9 (Expenses) views
-- Run after 20260519000004_views.sql.
-- Views inherit RLS from public.expenses (manager+owner only).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- expenses_with_meta — denormalized list view (property + logger name + staff
-- expense provenance). Used by the manager Expenses list + owner P&L recent
-- entries.
-- ----------------------------------------------------------------------------
create or replace view public.expenses_with_meta as
select
  e.id,
  e.property_id,
  prop.name as property_name,
  e.amount,
  e.category,
  e.description,
  e.receipt_url,
  e.spent_at,
  e.logged_at,
  e.source,
  e.booking_id,
  e.staff_expense_id,
  e.logged_by,
  logger.full_name as logged_by_name,
  se.staff_id as staff_expense_staff_id,
  staff.full_name as staff_expense_staff_name
from public.expenses e
left join public.properties prop  on prop.id   = e.property_id
left join public.profiles  logger on logger.id = e.logged_by
left join public.staff_expenses se on se.id    = e.staff_expense_id
left join public.profiles  staff  on staff.id  = se.staff_id;

-- ----------------------------------------------------------------------------
-- expenses_monthly_summary — totals per (property, month, category).
-- Owner's monthly P&L view reads this; cheap on small Ekaha-scale data.
-- ----------------------------------------------------------------------------
create or replace view public.expenses_monthly_summary as
select
  property_id,
  date_trunc('month', spent_at)::date as month,
  category,
  sum(amount)::numeric(12,2) as total,
  count(*)::int               as entry_count
from public.expenses
group by property_id, date_trunc('month', spent_at), category;
