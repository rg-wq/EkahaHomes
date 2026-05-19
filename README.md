# StayOps

Property operations management PWA for **Ekaha Homes** (3 short-stay properties in Chandigarh + Mohali).

See [STAYOPS_SPEC.md](./STAYOPS_SPEC.md) for the full product spec.

## Stack

- React 18 + Vite + Tailwind CSS + PWA (installable)
- Supabase (Postgres + Auth + Realtime + Edge Functions)
- Cloudinary (photos, receipts, ID docs)
- Vercel (hosting)

## Repo layout

```
StayOps/
├── client/               # React PWA (Vite)
├── supabase/
│   ├── migrations/       # SQL schema migrations (run via Dashboard or CLI)
│   └── functions/        # Edge Functions (Deno)
├── .env.example          # template — copy to .env.local
└── STAYOPS_SPEC.md       # product spec (source of truth)
```

## First-time setup

1. **Clone + install**
   ```sh
   cd client
   npm install
   ```

2. **Configure env**
   ```sh
   cp .env.example .env.local
   # fill in Supabase URL/keys, Cloudinary cloud name + preset
   ```

3. **Apply database migrations** — paste each file in `supabase/migrations/` into Supabase Dashboard > SQL Editor, run in order.

4. **Seed data** — run `supabase/seed.sql` in SQL Editor.

5. **Run dev server**
   ```sh
   cd client
   npm run dev
   ```

## Build order (in progress)

First slice — housekeeping + inventory + staff ledger vertical:
- Module 4 — Checklist template authoring (owner)
- Module 11 — Staff Phone OTP + GPS check-in
- Module 5 — HK mobile checklist with photo gates
- Module 6 — Manager QC approve/reject
- Module 8 — Inventory (count/par/trigger models, ledger, reorder)
- Module 13 — Staff ledger (advances + daily/travel expenses)

Later slices: Module 1 (bookings), 2 (guest ID), 3 (WhatsApp comms), 7 (laundry challan), 9 (full expenses UI), 10 (payout/invoice), 12 (reporting).
