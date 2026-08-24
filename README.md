# ResoVault — Personal Link Engine & Resource Hub

**ResoVault** is a fast, minimal, mobile-friendly personal Resource Hub web application built to save, organize, search, and manage links (Google Drive folders, GitHub repos, Google Docs, articles, or any URL).

---

## ⚡ Features

- **Instant Live Search**: Search across Title, Category, Tags, and Notes with zero page reload. Press `/` anywhere to focus search.
- **Visual Folder Cards**: Browse resources grouped by category with live resource count badges.
- **⚡ AI-Powered Bulk Import**: Paste raw unstructured chat text (WhatsApp, Slack, emails) to automatically extract links, scrape metadata, and assign categories & tags. Includes duplicate URL detection.
- **On-The-Fly Categories**: Select an existing category or create a custom new category dynamically.
- **Free-Text Tag Chips**: Interactive multi-tag builder with tag suggestions.
- **Smart Domain Detection**: Auto-detects logos & favicons for GitHub, Google Drive, Google Docs, YouTube, Figma, Notion, etc.
- **Grid & List Views**: Toggle between visual card grid layout and dense list row view.
- **1-Click Backup & Restore**: Export all your resources to a JSON file or import saved backups anytime.

---

## 🚀 Getting Started

### Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/bhuvan-0412/ResoVault.git
   cd ResoVault
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the local development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to [`http://localhost:3000`](http://localhost:3000).

---

## 🌐 Deploy to Vercel

To access ResoVault from your phone or computer anywhere:

1. Import your GitHub repository `https://github.com/bhuvan-0412/ResoVault.git` at [vercel.com/new](https://vercel.com/new).
2. Click **Deploy**.
3. (Optional) Set `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` in Vercel Environment Variables for AI Bulk Import enhancements.
