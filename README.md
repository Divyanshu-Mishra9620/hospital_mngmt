# Medora Multispeciality Hospital

A complete hospital website and management system: a public website plus four role-based portals — **Patient**, **Doctor**, **Pharmacy (medical store)** and **Administration** — sharing one database.

The patient portal is designed mobile-first as an app-style experience (bottom tab bar, large touch targets). The doctor, pharmacy and admin portals are laptop-first workspaces with a sidebar, and still work on phones and tablets.

> Medora is a fictional hospital. Names, phone numbers, addresses and people in the demo data are made up — replace `src/lib/constants.ts` and the seed data before using this for a real organisation. Payments are simulated (no money is charged).

---

## Quick start

Requirements: Node.js 20+ (tested on Node 22) and npm.

```bash
npm install
npm run setup      # creates the database and loads demo data
npm run dev        # http://localhost:3000
```

### Demo sign-ins

Sign in at `/login` with the ID **or** email, and the password:

| Role | ID | Password | Who |
|---|---|---|---|
| Patient | `MDR-100101` | `Patient@123` | Rahul Verma (diabetes + BP history, active prescriptions, diet plans) |
| Doctor | `DOC-1001` | `Doctor@123` | Dr. Ananya Rao, Cardiology |
| Pharmacy | `PHA-201` | `Pharma@123` | Suresh Kumar, pharmacist |
| Admin | `ADM-001` | `Admin@123` | Ritu Malhotra, administrator |

Every other seeded doctor (`DOC-1002` … `DOC-1022`) uses `Doctor@123`, and every patient (`MDR-100102` …) uses `Patient@123`. The login page has one-tap demo buttons.

### Try the video consultation

`npm run setup` books a **video consultation for today, ~10 minutes after you run it**, between Rahul Verma and Dr. Ananya Rao.

1. Open a normal window, sign in as `DOC-1001` → the dashboard shows the consult → **Join video call** → **Start consultation**.
2. Open a private/incognito window (or another browser or your phone on the same network), sign in as `MDR-100101` → **Join video call** → **Join consultation**.
3. You'll be connected peer-to-peer with video, audio, chat and a call timer. The doctor can open **Notes & Rx** to write the prescription and diet plan during the call, then **End & complete**.

Camera/microphone need `localhost` or HTTPS. Re-run `npm run setup` any time to reset the demo data (it also schedules a fresh video consult).

---

## What's included

### Public website
Home page (hero, quick actions, specialities, video-consult explainer, featured doctors, health packages, patient stories, health library), About, 16 specialities with detail pages, Find a Doctor with instant filtering and doctor profiles (OPD hours, next available slot, reviews), Facilities, Health check-up packages, Patients & Visitors (OPD, admission, insurance, billing, visiting hours, FAQs), Health Library articles, Contact (enquiry form → admin inbox), Careers, Privacy, Terms. Sticky Call / Book / Emergency bar on phones.

### Patient portal (`/patient`) — mobile-first
- **UHID** issued on self-registration; printable **health card with QR code**.
- **Book appointments** per doctor with live time slots: in-person (**₹500**) or video (**₹350**). Each doctor has an independent calendar; a slot can only be held once (enforced by a database unique index), a patient can't be double-booked at the same time, and booked/past slots are disabled.
- Appointment details: OPD token, room, directions, status timeline, receipt, **reschedule**, **cancel** (free up to 2 h before), rate the doctor.
- **Join video consultation** from 15 minutes before the slot.
- **Prescriptions** (printable / PDF) and **Add prescribed medicines to cart** — quantities are capped at what the doctor prescribed and what's in stock.
- **Pharmacy**: cart, checkout (pickup or home delivery, hospital discount, free-delivery threshold), order tracking and cancellation; over-the-counter essentials catalogue.
- **Diet & lifestyle plans** from the doctor (meal-by-meal timeline, foods to include/avoid, hydration, exercise, sleep) plus recommendations from your latest vitals (BMI, BP, sugar).
- **Health records**: vitals trends (BP, sugar, weight), visit history, investigations advised.
- Health check-up booking, bills & receipts, notifications, profile, emergency contact, insurance.

### Doctor portal (`/doctor`) — laptop-first
Today's queue with tokens, check-in / start / no-show, next-patient card; **consultation workspace** with patient summary (allergies highlighted), vitals entry, prescription composer (searches pharmacy stock, dose/frequency/timing/duration, auto-quantity, lab tests, advice, follow-up) and **diet plan templates**; patients list and full history; prescriptions; **OPD schedule & leave** management (in-person/video sessions, slot length, leave that refunds and notifies affected patients); earnings split in-person vs video; reviews; profile.

### Video consultation room (`/consult/[appointment]`)
Real one-to-one WebRTC call (peer-to-peer video & audio) with HTTP-polled signalling, lobby with camera preview, mic/camera toggles, chat, connection status and timer, rejoin on refresh, fee shown (₹350 vs ₹500 in person). Only the appointment's patient and doctor can enter.

### Pharmacy panel (`/pharmacy`) — medical store agent
- **Dispense against a prescription**: look up by Rx number, UHID, phone or name → the doctor's prescription with *prescribed / supplied / remaining* → bill (quantities can't exceed what's prescribed without an override), discount, cash/UPI/card/insurance → **GST tax invoice**.
- Walk-in OTC sales (prescription-only medicines are blocked).
- **Online orders** from patients: packing → ready for pickup / out for delivery → completed, or cancel with refund and stock returned.
- **Inventory** with batches and expiry, receive stock, batch adjustments and write-offs, **first-expiry-first-out** deduction, low-stock / out-of-stock / expiring alerts, full **stock ledger**, prescription register, sales history.

### Admin panel (`/admin`)
Dashboard (today's OPD, revenue trend, appointments by department, bed occupancy, stock alerts, live OPD board, recent activity); appointments (filter, cancel with refund); doctors (create, edit, **fees**, schedule, leave, availability preview, reset password, deactivate); departments; patients with full 360° record; staff accounts; **billing** with CSV export; pharmacy overview; **beds & admissions** (admit/discharge); health packages & bookings; enquiries; reviews; **audit log** of every action; settings (default fees, delivery fee, discount, booking window, announcement banner); printable reports.

---

## Tech stack

- **Next.js 16** (App Router, React 19, Server Components, Server Actions, Turbopack)
- **TypeScript**, **Tailwind CSS v4**
- **Drizzle ORM** on **SQLite / libSQL** — local file in development, [Turso](https://turso.tech) in production
- **jose** (JWT session cookies, HTTP-only), **bcryptjs** password hashing, **zod** validation
- **WebRTC** for video calls, **lucide-react** icons, **qrcode** for health cards

## Project structure

```
src/
  app/
    (site)/          public website
    (auth)/          login & patient registration
    patient/ doctor/ pharmacy/ admin/   the four portals
    consult/[code]/  video consultation room
    api/rtc/[code]/  WebRTC signalling endpoint
  components/        UI kit, portal shells, shared documents (prescription, status badges)
  db/                schema.ts (all tables), client, database location
  lib/               auth, slot engine, pharmacy stock (FEFO), actions per portal, queries, formatting
scripts/seed.ts      database migration + realistic demo data
drizzle/             SQL migrations
```

## Database

- Schema: `src/db/schema.ts`. Migrations are in `drizzle/` (`npm run db:generate` after changing the schema).
- In development the SQLite file is stored **outside the project** at `~/.medora-hospital/medora.db` (Windows: `C:\Users\<you>\.medora-hospital\medora.db`). This is deliberate: `next dev` watches every file in the project, and SQLite's write-ahead log changes on every write, which caused constant rebuilds and could crash Turbopack while seeding.
- Set `DATABASE_URL` to use a different location, e.g. `file:./local.db` or a Turso URL.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run setup` / `npm run db:seed` | Migrate and (re)load demo data — safe to re-run, even while `npm run dev` is running |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration after editing the schema |

## Deployment

1. Create a Turso database and set `DATABASE_URL=libsql://…` and `DATABASE_AUTH_TOKEN=…`.
2. Set `AUTH_SECRET` to a long random string (used to sign session cookies).
3. Run `npm run db:seed` once against that database (or migrate without demo data), then deploy (`npm run build`).
4. Serve over HTTPS so browsers allow camera/microphone access for video consultations.

Video calls connect peer-to-peer using a public STUN server. Most home and mobile networks work; some strict corporate networks need a TURN relay. Add one to the ICE server list in `src/components/consult/video-room.tsx`.

## Security notes

- Every portal page and server action checks the signed-in role on the server (`requireUser` / `requirePatient` / `requireDoctor` …); `src/proxy.ts` only adds early redirects.
- Patients can only see their own records; doctors can open patients who booked with them; every mutation is written to the audit log.
- Passwords are hashed with bcrypt; sessions are HTTP-only, `SameSite=Lax` cookies that expire after 12 hours.
