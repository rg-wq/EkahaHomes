# StayOps — Build Spec

Property operations management PWA for **Ekaha Homes** (short-stay / Airbnb hosting).
Owner runs 3 properties in Chandigarh + Mohali. System used by owner, manager, and housekeeping staff (mobile).

> This file is the source-of-truth for the build. Originated from `StayOps_VSCode_Prompt.md.pdf` + `StayOps_Complete_v4.pdf` (v4, May 2026).

---

## Tech stack

- **Frontend:** React (Vite) + Tailwind CSS — PWA (installable, no app store)
- **Backend:** Node.js + Express
- **DB:** Firebase Firestore
- **Auth:** Firebase Auth — phone OTP for staff, email/password for owner/manager
- **Storage:** Firebase Storage (photos, receipts, ID docs)
- **Notifications:** WhatsApp Business API via Twilio
- **Hosting:** Firebase Hosting
- **PDF:** pdfkit or puppeteer

---

## Properties (seed data)

```js
const properties = [
  { id: 'ekaha1', name: 'Ekaha Homes',    location: 'Sector 27, Chandigarh',   lat: 30.7333, lng: 76.7794 },
  { id: 'ekaha2', name: 'Ekaha Homes II', location: 'Sector 27/1, Chandigarh', lat: 30.7335, lng: 76.7797 },
  { id: 'ekaha7', name: 'Ekaha 7',        location: 'Phase 7, Mohali',         lat: 30.7046, lng: 76.7179 },
]
```

---

## User roles

| Role | Capabilities |
|---|---|
| **Owner** | Full dashboard across all properties · approve reorders · approve invoices · spot-audit QC photos · view all reports |
| **Manager** | Assign HK tasks · review QC checklists + photos · log expenses w/ receipts · file FRRO Form C · approve vendor IDs · receive all alerts |
| **Housekeeping** | Mobile-only · GPS check-in · room checklists w/ photo uploads · log laundry in/out · update inventory |

Firestore security rules must enforce **owner > manager > staff**.

---

## Build order (each module testable before next)

1. Firebase setup — Auth (Phone + Email), Firestore, Storage, security rules
2. **Module 1** — Booking sync + calendar
3. **Module 11** — Staff auth + GPS attendance
4. **Module 4** — Checklist templates
5. **Module 5** — Housekeeping operations (mobile checklist)
6. **Module 6** — QC review
7. **Module 7** — Laundry challan
8. **Module 8** — Inventory (wire to Module 7 here)
9. **Module 2** — Guest ID + verification
10. **Module 3** — Guest communication (WhatsApp)
11. **Module 9** — Expenses
12. **Module 10** — Payout + invoice
13. **Module 12** — Reporting dashboard

---

# Modules

## Module 1 — Booking sync & calendar
- Sync from Airbnb / Booking.com via iCal URL (interval `ICAL_SYNC_INTERVAL_MINUTES=15`)
- Unified calendar across all 3 properties
- Card shows: guest name, check-in/out, property, room, channel, booking ref
- On create: if stay > 1 night → set `midStayFlag: true`

```
bookings/{bookingId}
  guestName: string
  propertyId: string
  roomId: string
  checkIn: timestamp
  checkOut: timestamp
  channel: 'airbnb' | 'booking' | 'direct'
  bookingRef: string
  nights: number
  midStayFlag: boolean
  status: 'upcoming' | 'active' | 'completed'
  guestPhone: string        // populated after ID collection
  totalGuests: number
```

---

## Module 2 — Guest ID collection & verification
- At booking creation: send ID-collection link to primary booker
- Booker submits full guest list (name + nationality per guest)
- System sends individual ID link to each guest (WhatsApp/SMS)
- **Indian guests:** DigiLocker eKYC (OTP → consent → data returned). Store **only consent-shared Aadhaar fields**, **never the raw 12-digit number** — only `maskedIdNumber` (last 4)
- **Foreign nationals:** manual passport/visa upload + manager approval + **FRRO Form C** auto-queued (file at foreignersreportingonline.gov.in within **24h** of check-in; penalty up to ₹1,000/violation). Manager uploads receipt → store URL + mark `frroFiled: true`
- **Check-in is blocked until ALL guests verified**
- Collect marketing data from every guest

```
guests/{guestId}
  bookingId: string
  name: string
  nationality: 'indian' | 'foreign'
  idType: 'aadhaar' | 'passport' | 'other'
  verificationStatus: 'pending' | 'verified' | 'failed'
  verificationMethod: 'digilocker' | 'manual'
  maskedIdNumber: string         // last 4 only
  consentTimestamp: timestamp
  phone: string
  email: string
  homeCity: string
  purposeOfVisit: string
  bookingSource: string
  marketingConsent: boolean
  frroFiled: boolean
  frroReceiptUrl: string

guestProfiles/{phone}            // persistent across stays
  name, email, totalStays, lastStay, properties[], marketingConsent
```

---

## Module 3 — Guest communication
**Channel routing:**
- **Airbnb bookings:** display message **drafts** for manager to send manually via Airbnb app (Airbnb policy forbids moving comms off-platform before booking confirmed)
- **Direct bookings:** auto-send via WhatsApp Business API (Twilio)

**WhatsApp touchpoints (register templates with Twilio/Meta):**

| ID | Trigger | Template |
|---|---|---|
| T1 `welcome` | check-in day | "Welcome to Ekaha [property], [name]! WiFi: [ssid] / [password]. Any questions, WhatsApp [manager_name] on [manager_phone]." |
| T2 `hk_check` | evening before each non-checkout day (only if stay > 1) | "Hi [name], housekeeping tomorrow at Ekaha [property]? Reply YES to keep or NO to skip. No reply = we'll come at 12 PM." |
| T3 `checkout_reminder` | morning of checkout | "Hi [name], checkout today by [time]. Please leave keys at [location]. Safe travels!" |
| T4 `thank_you` | 2h after checkout | "Thank you for staying at Ekaha [property], [name]. Hope to see you again!" |
| T5 `review_request` | same day as T4 | "Hi [name], if you enjoyed your stay, a review would mean a lot. [review_link]" |
| T6 `re_engagement` | 30 days after checkout, only if `marketingConsent: true` | "Hi [name], it's been a month since your stay at Ekaha [property]. Book directly next time and we'll match any OTA price. [direct_booking_link]" |

**★ Mid-stay HK contact sharing:** when mid-stay HK task is created, staff notification **automatically includes guest WhatsApp + room number** so staff coordinates arrival time directly with guest (no manager middleman). Format: "Mid-stay clean today at [property] Room [X]. Guest: [name], WhatsApp: [phone]. Coordinate arrival time directly."

---

## Module 4 — Room checklist templates
- Owner creates per property + room type
- Zones: bedroom, bathroom, kitchen, common
- Auto-loads when checkout detected for that property + room
- Reusable + version-controlled

```
templates/{templateId}
  name: string                    // e.g. "Suite A — Ekaha 7 — full clean"
  propertyId: string
  roomType: string
  tasks: [{
    taskId: string
    name: string
    instructions: string
    zone: 'bedroom' | 'bathroom' | 'kitchen' | 'common'
    mandatory: boolean
    photoRequired: boolean
    sequence: number
    estimatedMinutes: number
    linkedInventoryItem: string | null
  }]
```

---

## Module 5 — Housekeeping operations
- Staff gets WhatsApp link → opens on phone (OTP auth, no login)
- **GPS check-in** — capture coords, compare to property geofence (100m radius); mismatch → alert manager

```js
navigator.geolocation.getCurrentPosition(position => {
  const { latitude, longitude } = position.coords
  // Compare to property lat/lng; flag if > 100m
})
```

- Checklist grouped by zone
- **Photo gates are hard blocks** — camera opens at checkpoints, upload to Firebase Storage, cannot mark `photoRequired` task done without photo
- Progress % live
- Track completion time → flag if `actual < estimated × 0.6` (suspiciously fast)
- On submit: notify manager

```
hkJobs/{jobId}
  bookingId, propertyId, roomId, templateId, staffId: string
  assignedAt, startedAt, completedAt: timestamp
  gpsCheckIn: { lat, lng, matched: boolean }
  tasks: [{ taskId, done: boolean, photoUrl: string | null, doneAt: timestamp }]
  status: 'assigned' | 'in_progress' | 'submitted' | 'approved' | 'rejected'
  qcNotes: string
  qcBy: string
  flaggedFast: boolean
```

---

## Module 6 — Quality check
- Manager notified on submit → review screen with all photos
- Approve all, or flag specific tasks with note
- Flagged tasks highlighted in staff app — staff re-does **only** those
- Loop until approved
- Owner can spot-audit any job from dashboard (async, remote)

---

## Module 7 — Laundry — dual-signed challan ★

> **Ground rule:** vendor does NOT leave until challan is signed. Eliminates billing disputes from 4 unwitnessed handoff points.

Flow:
1. **A** Staff counts items before pickup (logs item type + qty, timestamped)
2. **B** Challan auto-created (number e.g. `CH-2026-047`, date, property, items)
3. **C** Vendor arrives, counts in front of staff, enters count via OTP link (no app install)
4. **D** Both sign pickup → challan **locked**. Mismatch → recount together before proceeding
5. **E** Vendor does laundry; system notifies staff of expected return
6. **F** Vendor returns; staff counts vs challan; defect photos uploaded
7. **G ★** Shortfall → **auto-deduct from inventory** + notify owner with challan proof + run reorder check
8. **H ★** Full return → **auto-increment inventory**
9. **I** Both sign return → challan closed
10. **J** Monthly: system auto-matches vendor bill against all challan records

```js
// Wire laundry → inventory
async function processLaundryReturn(challanId, returnedItems) {
  const challan = await getChallan(challanId)
  for (const item of returnedItems) {
    const shortfall = challan.sentQty[item.name] - item.returnedQty
    await updateInventory(item.name, +item.returnedQty)   // always credit returned
    if (shortfall > 0) {
      await createShortfallFlag(challanId, item.name, shortfall)
      await notifyOwner(shortfall)
    }
    await checkReorderThreshold(item.name)                // always run reorder check
  }
}
```

```
challans/{challanId}
  challanNumber, propertyId, vendorId: string
  createdAt: timestamp
  status: 'pickup_pending' | 'in_laundry' | 'return_pending' | 'closed' | 'disputed'
  pickupItems: [{ name, staffQty, vendorQty }]
  pickupStaffSignature: { userId, timestamp }
  pickupVendorSignature: { name, timestamp, otp_verified: boolean }
  returnItems: [{ name, sentQty, returnedQty, shortfall, condition }]
  returnStaffSignature: { userId, timestamp }
  returnVendorSignature: { name, timestamp }
  defectPhotos: [string]
  shortfalls: [{ item, qty, status: 'pending' | 'resolved' }]
```

---

## Module 8 — Inventory ★

**Three tracking models:**

| Model | Items | How |
|---|---|---|
| **Count units** | Toilet rolls, water bottles, tea/coffee/sugar sachets, shampoo, bodywash, handwash, tissue boxes, towels (bath/hand), bedsheets, pillow covers | Exact number, auto-deducted when staff ticks linked task |
| **Par level** | Toilet cleaner, floor cleaner, dishwasher liquid, room freshener, open tea jar, open sugar jar | Staff answers "topped up?" Yes/No — not counted in units |
| **Replace trigger** | Floor cleaner bottle (every 15 refills), Toilet cleaner bottle (every 15 refills) | Auto-prompt after N refills |

**Two-level buffer:** Room stock → Store cupboard → Supplier. Staff tops up room from cupboard freely (no approval). System alerts when cupboard hits reorder threshold.

**Smart reorder qty** = `current stock + (avg consumption per checkout × 14 days of bookings ahead)`

**Unified inventory ledger — every event:**

| Event | Effect | Reorder check? | Who acts |
|---|---|---|---|
| Staff uses item in room | -N room stock | If room low → top from cupboard | Staff |
| Staff tops up room from cupboard | -N cupboard | Yes if cupboard ≤ threshold | Auto |
| Laundry sent out | unchanged (in transit) | No | Staff log |
| **Full laundry return ★** | **+N cupboard** | **Yes after every return** | Auto |
| **Laundry shortfall ★** | **+returned only; shortfall deducted** | **Yes — may fire immediately** | Auto |
| New stock received | +N cupboard | No (count going up) | Manager |
| Replace trigger | -1 old +1 new (net 0) | No | Staff |
| Par refill | topped up (not qty-tracked) | If supply cupboard low → alert | Staff |

```
inventory/{propertyId}/items/{itemId}
  name: string
  trackingModel: 'count' | 'par' | 'trigger'
  cupboardQty: number
  roomQty: number
  reorderThreshold: number
  reorderQty: number
  unit: string
  linkedSupplierId: string
  replaceAfterN: number | null    // trigger model
  refillCount: number             // trigger model
  lastUpdated: timestamp
  lastUpdatedBy: string

inventoryLedger/{propertyId}/events/{eventId}
  itemId: string
  eventType: 'staff_use' | 'topup_room' | 'laundry_return' | 'laundry_shortfall'
           | 'new_stock' | 'replace_trigger' | 'par_refill'
  qty: number                     // + in, - out
  relatedId: string               // challanId, hkJobId, etc.
  timestamp: timestamp
  performedBy: string
```

---

## Module 9 — Expenses
- Manager logs: amount, category, property, date, receipt photo
- Categories: Laundry, Housekeeping supplies, Maintenance, Utilities, Staff, Other
- Owner sees live P&L per property per month
- Auto-link to bookings when possible

```
expenses/{expenseId}
  propertyId: string
  amount: number
  category: string
  description: string
  receiptUrl: string
  loggedBy: string
  loggedAt: timestamp
  bookingId: string | null
```

---

## Module 10 — Payout & invoice generation ★

> **Trigger is the payout arriving — not the checkout.** Keeps financials reconciled to actual cash received.

On payout receipt (manual or auto-detected):
- Match to booking
- Generate invoice PDF (sequential number e.g. `EKAHA-2026-047`)
- Owner downloads or shares with accountant
- Monthly history filterable by property/channel

Invoice fields: booking ref · guest name · check-in/out · property+room · gross · OTA commission · net payout · GST (18%) · sequential invoice number · payment status.

---

## Module 11 — Staff attendance
- GPS check-in at shift start
- Captures: timestamp, coords, property assigned
- Geofence: flag if > 100m from property
- Daily log per staff per property
- Exportable PDF/CSV for payroll

---

## Module 12 — Reporting dashboard
Owner sees all 3 properties simultaneously. Per-property metrics:
- Occupancy rate, revenue, avg nightly rate, total expenses, net P&L
- HK turnaround time, laundry shortfall rate, staff QC score
- **Guest database** — verified contacts with stay history, filterable, exportable
- **Vendor scorecard** — laundry reliability, shortfall history, bill accuracy

---

# Key business rules (must implement)

```js
// 1. Check-in blocked until ALL guests verified
function canCheckIn(bookingId) {
  const guests = getGuestsForBooking(bookingId)
  return guests.every(g => g.verificationStatus === 'verified')
}

// 2. Vendor cannot leave until challan signed
// Status cannot move 'pickup_pending' → 'in_laundry' without both signatures

// 3. Photo gate — hard block
function canCompleteTask(task, uploadedPhotos) {
  if (task.photoRequired && !uploadedPhotos[task.taskId]) return false
  return true
}

// 4. Laundry shortfall → immediate inventory deduction
//    (see processLaundryReturn above)

// 5. Mid-stay HK contact sharing
//    When mid-stay task created, staff notification includes guest phone + room

// 6. Suspiciously fast completion flag
function isSuspiciouslyFast(job) {
  const totalEstimated = job.tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0)
  const actualMinutes = (job.completedAt - job.startedAt) / 60000
  return actualMinutes < totalEstimated * 0.6
}

// 7. Airbnb vs WhatsApp routing
function getCommChannel(booking) {
  if (booking.channel === 'airbnb') return 'airbnb_draft'   // manual send
  return 'whatsapp_auto'                                    // Twilio
}
```

---

# Folder structure

```
stayops/
├── client/                          # React frontend (Vite)
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx          # Owner overview
│       │   ├── Bookings.jsx           # Booking calendar
│       │   ├── GuestID.jsx            # ID collection + verification
│       │   ├── Housekeeping.jsx       # HK job management
│       │   ├── ChecklistMobile.jsx    # Staff mobile checklist
│       │   ├── Laundry.jsx            # Challan management
│       │   ├── Inventory.jsx          # Stock management
│       │   ├── Expenses.jsx
│       │   ├── Invoices.jsx           # Payout + invoice
│       │   ├── Communication.jsx      # Guest comms hub
│       │   ├── Reports.jsx            # Analytics + guest DB
│       │   └── Staff.jsx              # Attendance + team
│       ├── components/
│       │   ├── PropertyCard.jsx
│       │   ├── ChallanForm.jsx
│       │   ├── ChecklistTask.jsx
│       │   ├── PhotoUpload.jsx
│       │   ├── InventoryItem.jsx
│       │   └── GuestVerification.jsx
│       ├── hooks/
│       │   ├── useFirestore.js
│       │   ├── useAuth.js
│       │   ├── useGeolocation.js
│       │   └── useInventory.js
│       ├── lib/
│       │   ├── firebase.js
│       │   ├── whatsapp.js            # Twilio integration
│       │   └── ical.js                # iCal sync
│       └── App.jsx
├── server/                          # Node.js + Express
│   ├── routes/
│   │   ├── bookings.js
│   │   ├── guests.js
│   │   ├── housekeeping.js
│   │   ├── laundry.js
│   │   ├── inventory.js
│   │   ├── invoices.js
│   │   └── whatsapp.js
│   ├── services/
│   │   ├── icalSync.js
│   │   ├── pdfGenerator.js
│   │   ├── whatsappService.js
│   │   └── inventoryLedger.js
│   └── index.js
├── firebase.json
├── firestore.rules
└── package.json
```

---

# Environment variables

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

ICAL_SYNC_INTERVAL_MINUTES=15
```

---

# Start command

```bash
npm create vite@latest stayops-client -- --template react
cd stayops-client
npm install tailwindcss firebase react-router-dom @tanstack/react-query axios
npx tailwindcss init -p
```

Then create Firebase project → enable Auth (Phone + Email), Firestore, Storage → deploy security rules enforcing **owner > manager > staff**.

---

# 17-phase operational flow (reference)

1. Booking → 2. Guest ID + eKYC + FRRO ★ → 3. Comms routing ★ → 4. Pre-arrival → 5. Check-in → 6. Stay → 7. Mid-stay HK + contact ★ → 8. Checkout → 9. Housekeeping → 10. QC → 11. Laundry challan ★ → 12. Inventory ★ → 13. Expenses → 14. Payout & Invoice ★ → 15. Post-stay comms ★ → 16. Room ready (2–4h target) → 17. Reporting

★ = new/critical in v4.

---

# SaaS notes (future)

3 Ekaha properties = proof of concept. Validate before selling. Differentiators:
- DigiLocker eKYC built into guest flow (unique in Indian short-stay)
- FRRO Form C automation
- Verified-consent guest database for direct-booking campaigns
- Mid-stay HK contact sharing (no manager middleman)
- Challan-backed laundry with dual sign
- Laundry ↔ inventory integration
- Payout-triggered invoicing (GST-ready)

Pricing signal: ₹999–₹2,499 per property/month.
