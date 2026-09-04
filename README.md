# ResoVault — Cross-Device Resource Vault & Curated Daily News Hub

[![Live App](https://img.shields.io/badge/Production-Live%20on%20Vercel-success?style=for-the-badge&logo=vercel)](https://resovault.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js%2016-Turbopack-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Auth-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)

**ResoVault** is a modern, fast, cross-device personal link engine and personalized news hub. Save links on your laptop, access them instantly on your phone, and stay informed with an engagement-weighted daily news digest curated to your exact interests.

---

## 🌐 Live Production Links

* **Live Web App**: [https://resovault.vercel.app](https://resovault.vercel.app)
* **GitHub Repository**: [https://github.com/bhuvan-0412/ResoVault](https://github.com/bhuvan-0412/ResoVault)

---

## ⚡ Core Features

### 1. 🗄️ Cross-Device Personal Link Vault
- **Multi-Device Cloud Sync**: Backed by Supabase PostgreSQL — every link, category, and tag is tied to your Google account and accessible anywhere.
- **Instant Search**: Live search across title, description, category, tags, and notes with zero reload. Press `/` anywhere to focus search.
- **Visual Folder Cards & List Views**: Toggle between interactive folder cards and dense list rows.
- **Auto-Metadata Extraction**: Automatic scraping of YouTube oEmbed titles/thumbnails and Open Graph metadata for saved links.
- **AI Bulk Import**: Paste raw unstructured chat messages (WhatsApp, Slack, emails) to automatically extract links, scrape metadata, and assign categories.
- **1-Click Backup & Migration**: Export/import JSON backups and migrate legacy browser local storage into your Supabase cloud account with one click.

### 2. 📰 Personalized News Feed & Daily Digest
- **NewsData.io Ingestion**: Server-side scheduled job ingests fresh stories without exposing API keys to the browser.
- **Curated Digest (Not Infinite Scroll)**: Delivers a clean, focused daily digest of top 10–15 articles with estimated reading times and publisher source icons.
- **High-Signal Breaking News Section**: Detects urgent alerts (`zero-day`, `critical`, `breaking`, `announces`, `launches`) and displays them in a distinct banner with radar pulse badges.
- **Interactive Topic Customizer**: Pick domains (*Technology*, *AI & Machine Learning*, *Development*, *Product Management*, *Design*, *Cybersecurity*, *Startups*, etc.) and add custom focus keywords (e.g., `nextjs`, `supabase`, `transformers`).
- **Engagement-Weighted Scoring**: Analyzes your past 30-day click logs to continuously rank topics you actually interact with higher in future digests.
- **Instant "Save to Vault"**: Convert any interesting article from your daily digest directly into a permanent link in your personal vault.

### 3. 🗓️ ML-Generated Personalized Timetable & Smart Schedule
- **Conflict-Aware Schedule Engine**: Automatically detects overlapping commitments (e.g., conflicting classes or meetings) and warns you before generation.
- **Deadline Reverse-Planning**: Prioritizes upcoming deadlines and reverse-plans focused study/work blocks backward from due dates into available free-time slots.
- **Natural Language Habit & Preference Parser**: Simply type *"I like working out in the evenings around 7pm, and I'm a night owl"* — an LLM parses it into recurring commitments and peak energy preferences.
- **Adaptive Completion Feedback Loop**: Every block marked as *Done* or *Skipped* is logged into `schedule_completions`. Past completion trends are fed back into future timetable generation (e.g., if you consistently skip early-morning blocks, the engine shifts demanding focus to later hours).
- **Streak & Consistency Gamification**: Real-time daily completion percentage meters, 7-day consistency scores, and a persistent streak counter (days with ≥ 70% completion).
- **Scheduled & On-Demand Generation**: Early morning automated cron pre-generation (`/api/cron/generate-schedules`) plus a 1-click manual "Regenerate" button.

### 4. 🛡️ Enterprise-Grade Security & RLS
- **Google OAuth Authentication**: Secure authentication via Supabase Auth with Google provider.
- **Row Level Security (RLS)**: Enforced directly at the PostgreSQL database level:
  - `resources` & `categories`: Private per user (`auth.uid() = user_id`).
  - `fixed_events`: Recurring commitments private per user (`auth.uid() = user_id`).
  - `todos`: Action items and deadlines private per user (`auth.uid() = user_id`).
  - `generated_schedules`: Timetable outputs private per user (`auth.uid() = user_id`).
  - `schedule_completions`: Completion logs private per user (`auth.uid() = user_id`).
  - `user_schedule_preferences`: Energy & chronotype settings private per user (`auth.uid() = user_id`).
  - `user_topics` & `user_article_clicks`: Private per user (`auth.uid() = user_id`).
  - `news_articles`: Shared read-only for authenticated users (`USING (true)`). Writes locked to `service_role` key.
- **Zero Client-Side LLM Key Exposure**: LLM API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) and `SUPABASE_SERVICE_ROLE_KEY` are strictly server-side and never sent to the browser. Fallback heuristic algorithms guarantee zero-downtime execution even when external AI quotas expire.

---

## 🛠️ Architecture & Tech Stack

* **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL + Auth + Row Level Security)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **News API**: [NewsData.io](https://newsdata.io/)
* **Deployment & Cron**: [Vercel](https://vercel.com/) (Vercel Cron Jobs)

---

## 🗃️ Database Schema

Run [supabase/schema.sql](supabase/schema.sql) in your [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql/new) to set up all tables and security policies:

| Table | Purpose | Security Policy (RLS) |
| :--- | :--- | :--- |
| **`public.resources`** | User links, tags, categories, and notes | Private (`auth.uid() = user_id`) for SELECT, INSERT, UPDATE, DELETE |
| **`public.categories`** | User folder categories | Private (`auth.uid() = user_id`) for SELECT, INSERT, DELETE |
| **`public.fixed_events`** | User recurring commitments (classes, gym, work) | Private (`auth.uid() = user_id`) for SELECT, INSERT, UPDATE, DELETE |
| **`public.todos`** | User tasks with due dates, priority, duration | Private (`auth.uid() = user_id`) for SELECT, INSERT, UPDATE, DELETE |
| **`public.generated_schedules`** | ML-generated daily plans per date | Private (`auth.uid() = user_id`) for SELECT, INSERT, UPDATE, DELETE |
| **`public.schedule_completions`** | Block completion & skip logs for adaptive feedback | Private (`auth.uid() = user_id`) for SELECT, INSERT, UPDATE, DELETE |
| **`public.user_schedule_preferences`** | Chronotype, wake/sleep hours, energy preferences | Private (`auth.uid() = user_id`) for SELECT, INSERT, UPDATE, DELETE |
| **`public.news_articles`** | Shared ingested news feed cache | Shared read-only for users (`USING (true)`). Writes locked to `service_role` key |
| **`public.user_topics`** | User domain & custom keyword preferences | Private (`auth.uid() = user_id`) for SELECT, INSERT, UPDATE, DELETE |
| **`public.user_article_clicks`** | User click logs for digest engagement weighting | Private (`auth.uid() = user_id`) for SELECT, INSERT. UPDATE/DELETE disallowed |

---

## 🔑 Environment Variables

Copy `.env.example` to `.env.local` and populate the values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
| :--- | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Your Supabase project URL (`https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Your Supabase public anonymous API key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Your Supabase secret service role key (Server-only, bypasses RLS for cron ingest) |
| `NEWSDATA_API_KEY` | **Yes** | NewsData.io API key for news ingestion (Register free at [newsdata.io](https://newsdata.io)) |
| `CRON_SECRET` | Optional | Bearer token to protect `/api/cron/fetch-news` from unauthorized external hits |
| `GEMINI_API_KEY` | Optional | AI provider key for AI bulk text parser (Claude or OpenAI keys also supported) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- A free [Supabase](https://supabase.com) account
- A free [NewsData.io](https://newsdata.io) account

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/bhuvan-0412/ResoVault.git
   cd ResoVault
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create `.env.local` using the table above or copy from `.env.example`.

4. **Initialize Database**:
   Copy and run [supabase/schema.sql](supabase/schema.sql) in your [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql/new).

5. **Start development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deploy to Vercel

1. Push your code to GitHub.
2. Import the repository in [Vercel](https://vercel.com/new).
3. In **Settings -> Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEWSDATA_API_KEY`
   - `CRON_SECRET`
4. Click **Deploy**.
5. In your [Supabase Dashboard -> Auth -> URL Configuration](https://supabase.com/dashboard/project/_/auth/url-configuration), add your production redirect URL:
   ```
   https://resovault.vercel.app/auth/callback
   ```
6. The scheduled cron job in [vercel.json](vercel.json) will automatically run daily at `0 6 * * *` to ingest fresh news!

---

## 📄 License

MIT License. Free for personal and commercial use.
