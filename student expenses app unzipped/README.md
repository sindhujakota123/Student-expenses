# Student Expenses: setup

A mobile-first app for students, roommates, and households to track shared expenses and settle up.

**Stack:** Vite + React 19 + TypeScript + Tailwind CSS v4 (frontend), Vercel
serverless functions in `api/` (backend), Supabase Postgres + Auth.

## Requirements
- Node.js 20+ and npm
- A Supabase project (free tier is fine)
- A Vercel account to deploy, or the Vercel CLI for local full-stack dev

## 1. Install
```bash
npm install
```

## 2. Create the database
In the Supabase dashboard, open **SQL Editor**, paste in `supabase/schema.sql`,
and run it. It creates the tables and indexes. It also turns off direct access
from the browser, so household data can only be reached through the API.

In **Authentication -> Providers**, make sure Email is enabled. If you'd rather
skip email confirmation while testing, turn off "Confirm email".

## 3. Configure environment variables
```bash
cp .env.example .env
```
Fill in your project URL and keys from **Project Settings -> API**.
`SUPABASE_SERVICE_ROLE_KEY` is only used by the server code in `api/`. Never
prefix it with `VITE_` or expose it to the browser.

## 4. Run locally
The frontend calls `/api/*`, so use the Vercel CLI to run the frontend and the
serverless functions together:
```bash
npm i -g vercel
vercel dev
```
(`npm run dev` on its own only serves the frontend, so API calls will fail.)

## 5. Deploy
```bash
vercel        # first time: link or create the project
vercel --prod
```
In the Vercel project settings, add every variable from `.env`.
`vercel.json` sends all routes except `/api/*` to `index.html`, so links like
`/join/CODE` and `/h/:id` work.

## 6. Create a first account
Sign up in the app, or add a user under **Authentication -> Users**. Create a
household, then share the invite code or link with roommates.

## How privacy works
- Every API route checks the caller's Supabase access token
  (`Authorization: Bearer ...`).
- Every read or write checks that the caller belongs to the household
  (`requireMember` in `api/_lib.js`).
- With direct access turned off, the public key can't read or write the tables.

## Project layout
```
api/            serverless routes (households, household, members, join, expenses, payments)
  _lib.js       auth check, membership check, validation, error handling
  db-client.js  Supabase service-role client
src/
  pages/        Login, Home, Join, HouseholdLayout, Overview, Activity,
                ExpenseForm, SettleForm, Members, NotFound
  components/   shared UI pieces, toasts, activity row, protected route
  contexts/     auth and household state
  lib/          API client, money math (splits, balances, settle-up), types
supabase/schema.sql
```

## Scripts
- `npm run build`: type-check and build to `dist/`
- `npm run lint`: ESLint

## Known limitations
- Invites are links or codes only; no invite emails or notifications.
- One currency per household; no exchange rates.
- No receipt photos, recurring bills, or splitting by percentage or shares.
- Payments made elsewhere are recorded by hand; no in-app payments.
- No live updates: other members' changes appear on reload.
- Any member can edit or delete any expense; there's no change log.

## Demo data
A deployment seeded from this repo can include a demo account and household.
To make your own: sign up, create a household, and add placeholder members
from the Members tab. No seed script is needed; all data is created
through the app.
