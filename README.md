# JobSnap — Worker Mobile App

The field worker's companion to the JobSnap web dashboard (`../jobsnap`). Workers log in,
see the jobs assigned to them, and submit on-site updates: **photo / video + remark + GPS
location**, optionally moving the job's status. Everything goes to the **same Supabase
project** as the web app, so the manager sees updates in real time.

Expo SDK 53 · expo-router · TypeScript · `@/*` → root alias.

## Setup

1. Make sure the web app's `supabase/schema.sql` has already been run (shared backend).
2. Copy `.env.example` → `.env` and fill in the **same** Supabase URL + anon key the web
   app uses (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
3. Install & run:
   ```bash
   npm install
   npx expo start
   ```

## Worker accounts
Workers do **not** sign up. The boss creates their account in the web dashboard
(Workers → Add worker); the worker just logs in here with that email + password.

## What a worker can do
- **My Jobs** — pull-to-refresh list of tasks assigned to them (status + priority + due date).
- **Job detail** — read the brief, then:
  - capture **photos** / **videos** (camera) or pick from the gallery (up to 6),
  - write a **remark**,
  - optionally set status (In Progress / On Hold / Completed),
  - **Send update** — GPS location is captured automatically and stored with the update.
- **Settings** — see who they're signed in as, and sign out.

## How uploads work
Media is uploaded to the private `task-media` bucket using the path convention the web app
expects: `<org_id>/<task_id>/<update_id>/<timestamp>_<index>.<ext>`. The update row, media
rows, and (if a status was chosen) the task status are all written under RLS — a worker can
only post to a task assigned to them.

## Camera / location notes
`expo-image-picker` + `expo-location` need native permissions, declared in `app.json`. The
camera and GPS work in a **dev build** (`npx expo run:android` / EAS dev build) and on a real
device; the iOS simulator has no camera. Not yet built/tested on a device.
