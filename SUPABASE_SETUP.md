# Supabase setup for Prog

Supabase is Prog's online backend. It provides:

- **Database** — programs, routines, workouts, sets, history and statistics data.
- **Authentication** — the account that owns the training data.
- **Storage** — private progress photos and exported files later.

You do not need to understand the database before using Prog. We will add one
feature at a time and I will explain what each table and policy does.

## 1. Create a project

1. Go to [supabase.com](https://supabase.com) and create an account.
2. Choose **New project**.
3. Name it `prog`.
4. Choose a strong database password and save it in your password manager.
5. Select a nearby region.
6. Wait for the project to finish provisioning.

## 2. Find the two app values

Open **Project Settings → API**. Copy:

- **Project URL**
- **Publishable key** (older projects may call this the `anon` key)

The publishable/anon key is designed to be used by the browser. Never put the
secret `service_role` key in the browser, GitHub, `.env.example`, or a message.

In **Authentication → URL Configuration**, add `http://localhost:3000` to the
allowed redirect URLs. We will add the production URL after deployment.

## 3. Add local environment values

Create a file called `.env.local` beside `package.json` and add:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Keep `.env.local` private. It is ignored by Git. The committed
`.env.example` file is only a template and must not contain real values.

## 4. Create Prog's tables

1. In Supabase, open **SQL Editor**.
2. Create a new query.
3. Copy the contents of
   `supabase/migrations/0001_prog_core.sql` into the query.
4. Click **Run**.

This creates the tables and security rules for the first version. The rules
ensure that one signed-in user cannot read another user's workouts.

## 5. What is connected now

After the migration is installed and you sign in, Prog can currently:

1. Sign in with an email magic link.
2. Load and create exercises in your private exercise library.
3. Save completed workout sessions, exercises and sets.
4. Load recent saved sessions into the overview and calendar.
5. Keep an unfinished workout draft on the current device.

Programs and routines are still local prototype data. The progress charts,
personal records, bodyweight statistics and some calendar summaries also still
contain sample values. Those are the next database slices to complete.

## Important safety rules

- Do not share your database password.
- Do not share a `service_role` key.
- Do not commit `.env.local`.
- If a key is accidentally exposed, rotate it in **Project Settings → API**.
- Keep Row Level Security enabled on every user-owned table.
