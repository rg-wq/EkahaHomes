# Supabase setup — one-time

## Step 1 — Run migrations in order

Open Supabase Dashboard → **SQL Editor** → **New query**, then paste and run each file **in this exact order**:

1. `migrations/20260519000001_schema.sql` — tables + enums + indexes
2. `migrations/20260519000002_helpers_and_triggers.sql` — role helpers, triggers, auto-profile-on-signup, ledger qty trigger, staff_expense → expense wire
3. `migrations/20260519000003_rls.sql` — Row Level Security policies (owner > manager > staff)
4. `migrations/20260519000004_views.sql` — `staff_ledger_view`, `pending_qc_jobs_view`, `inventory_status_view`

After each runs successfully you should see `Success. No rows returned`. If any errors, paste them back and we'll diagnose.

## Step 2 — Create test users

Dashboard → **Authentication → Users → Add user → Create new user**. Create four:

| Email | Password | Role (set in step 3) |
|---|---|---|
| `owner@ekaha.test` | (pick a strong one, save in pwd mgr) | owner |
| `manager@ekaha.test` | ... | manager |
| `staff1@ekaha.test` | ... | staff |
| `staff2@ekaha.test` | ... | staff |

For each user: **uncheck "Auto Confirm User"** is false (i.e. leave Auto-Confirm ON) so they're confirmed immediately — we're not doing email verification in dev.

When each user is created, the `handle_new_user` trigger automatically inserts a row into `public.profiles` with default `role='staff'`. Step 3 promotes them.

## Step 3 — Assign roles + property access

Dashboard → **SQL Editor** → run:

```sql
update public.profiles set role = 'owner',  property_ids = array['ekaha1','ekaha2','ekaha7']
  where email = 'owner@ekaha.test';
update public.profiles set role = 'manager', property_ids = array['ekaha1','ekaha2','ekaha7']
  where email = 'manager@ekaha.test';
update public.profiles set role = 'staff',   property_ids = array['ekaha1','ekaha2']
  where email = 'staff1@ekaha.test';
update public.profiles set role = 'staff',   property_ids = array['ekaha7']
  where email = 'staff2@ekaha.test';

-- Verify
select email, role, property_ids from public.profiles order by role, email;
```

## Step 4 — Run seed data

Dashboard → SQL Editor → paste `seed.sql` (just the data sections; the role-update commented section at the bottom is what you ran in step 3).

You should now have:
- 3 properties (ekaha1/ekaha2/ekaha7)
- 6 rooms (2 suites per property)
- 3 templates (one "Suite — Full Clean" per property)
- ~48 inventory items (16 per property)
- 4 users (1 owner, 1 manager, 2 staff)

## Step 5 — Smoke test from the app

Once env values are in `client/.env.local` (handled separately), run:

```sh
cd client
npm install
npm run dev
```

Open http://localhost:5173 and try signing in with `owner@ekaha.test`. If you see the dashboard placeholder load without console errors, wiring is good.
