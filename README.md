# Golf outing availability site

Mobile-first static site with a Vercel serverless form endpoint. It collects name, email, summer weekend availability, typical 18-hole scoring range, and optional planning suggestions.

## Local preview

Preview the design only:

```bash
npm run preview
```

Open `http://localhost:3000`.

Preview with the hidden name-testing controls:

```text
http://localhost:3000?test=1
```

To test the form endpoint locally, use Vercel dev:

```bash
npm run dev
```

## Design testing

The public page does not show testing controls. Add `?test=1` to reveal event-name prototypes.

Current name prototypes include The Copley Invitational, The Summit Cup, The 330 Classic, The Crosstown Invitational, and The Portage Path Classic.

To change the default public name, edit `DEFAULT_NAME_ID` in `script.js`.

## Storage/deploy plan

Deploy on Vercel's free tier. Vercel hosts the static website and `/api/rsvp.js` serverless endpoint, so no home port-forwarding is required.

For free persistent response storage, create a Supabase project and add these Vercel environment variables:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_TABLE=golf_rsvps
```

Create the Supabase table with:

```sql
create table public.golf_rsvps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  event_name text,
  event_name_id text,
  theme_seen text,
  planning_suggestion text,
  name text not null,
  email text not null,
  score_low integer not null,
  score_high integer not null,
  handicap_estimate_low integer,
  handicap_estimate_high integer,
  availability jsonb not null,
  user_agent text
);

alter table public.golf_rsvps enable row level security;
```

If the table already exists from an earlier version, add the suggestions column:

```sql
alter table public.golf_rsvps add column if not exists planning_suggestion text;
```

No public Supabase policy is needed because inserts use the server-only service role key from the Vercel API route.

When Supabase is not configured locally, submissions are written to `.local-submissions/rsvps.jsonl` for development only.
