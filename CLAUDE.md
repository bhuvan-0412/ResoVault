# CLAUDE.md — Developer Guidelines & Architecture Reference

This file provides guidance for AI assistants and developers working on **ResoVault**.

---

## 💻 Common Commands

```bash
# Start local development server (Turbopack on port 3000)
npm run dev

# Compile production build & run TypeScript type checks
npm run build

# Run ESLint validation
npm run lint

# Deploy to Vercel production
npx vercel deploy --prod --yes
```

---

## 🏛️ Project Architecture

```
d:\Resource Hub/
├── app/
│   ├── layout.tsx              # Root HTML shell, fonts, global metadata
│   ├── page.tsx                # Main view: Vault vs Daily Digest tabs
│   ├── auth/callback/route.ts  # Supabase OAuth redirect exchange handler
│   └── api/
│       ├── resources/route.ts   # CRUD endpoint for personal links
│       ├── categories/route.ts  # User categories endpoint
│       ├── metadata/route.ts    # YouTube oEmbed & Open Graph scraper
│       ├── bulk-parse/route.ts  # AI/Regex parser for unstructured chat text
│       ├── cron/
│       │   └── fetch-news/      # Scheduled news ingestion (NewsData.io)
│       └── news/
│           ├── digest/route.ts  # Curated & engagement-weighted daily digest
│           ├── topics/route.ts  # User topic & keyword preferences
│           └── click/route.ts   # Article click interaction logger
├── components/
│   ├── Navbar.tsx               # Header, logo, search bar, and Vault/Digest tab switcher
│   ├── ResourceCard.tsx         # Visual folder card view for links
│   ├── ResourceListRow.tsx      # Dense list row view
│   ├── NewsDigestTab.tsx        # Curated daily digest UI with breaking banner
│   ├── TopicCustomizerModal.tsx # Topic pill selector & custom keyword builder
│   ├── CategoryOverview.tsx     # Category folder pills with live counts
│   ├── AddEditModal.tsx         # Single link add/edit form with auto-fetch
│   ├── BulkImportModal.tsx      # Multi-link paste & AI categorization modal
│   ├── AuthModal.tsx            # Google Sign-In modal
│   ├── MigrationBanner.tsx      # Browser localStorage to Supabase migration banner
│   └── StatsBar.tsx             # Total counts & sorting dropdowns
├── lib/
│   ├── types.ts                 # Core TypeScript interfaces (Resource, NewsArticle, etc.)
│   ├── storage.ts               # Supabase data layer abstraction (replaces localStorage)
│   └── supabase/
│       ├── client.ts            # Client-side Supabase browser client (`createBrowserClient`)
│       └── server.ts            # Server-side Supabase client & service role admin client
├── supabase/
│   └── schema.sql               # PostgreSQL tables, triggers, indexes, and RLS policies
└── vercel.json                  # Vercel daily cron configuration (`0 6 * * *`)
```

---

## 🛡️ Database & Row Level Security (RLS) Rules

1. **User-Scoped Tables (`resources`, `categories`, `user_topics`, `user_article_clicks`)**:
   - Must enforce `auth.uid() = user_id`.
   - Never insert `null` for `user_id`; always pull `user.id` from `auth.getUser()`.
   - Regular users can only read and modify their own data.

2. **Shared Table (`news_articles`)**:
   - `SELECT` is granted to `authenticated` users (`USING (true)`).
   - `INSERT`, `UPDATE`, and `DELETE` are **NOT** permitted for regular users (PostgreSQL RLS default deny).
   - Only the server cron worker using `SUPABASE_SERVICE_ROLE_KEY` via `createServiceRoleSupabaseClient()` can write to `news_articles`.

3. **Frontend Write Guarantee**:
   - The frontend must never write directly to `news_articles`.
   - "Save to Vault" actions convert an article into a user `Resource` inserted into `public.resources`.

---

## 🔑 Key Environment Variables

* `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
* `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Client-side anonymous API key.
* `SUPABASE_SERVICE_ROLE_KEY` — Secret service role key (bypasses RLS for server cron).
* `NEWSDATA_API_KEY` — NewsData.io API key for news fetching.
* `CRON_SECRET` — Bearer secret protecting `/api/cron/fetch-news`.
