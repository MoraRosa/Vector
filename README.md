# Vector

A low-friction job application tracker: paste a listing, get auto-filled fields, click a pill to advance status, and watch a small dashboard track your pipeline. No spreadsheets, no manual checkboxes.

## Features
- **Paste-to-parse**: paste raw job posting text and it extracts company, title, location, work type, salary, and recruiter name where possible
- **One-click status**: click a pill to advance (Wishlist → Applied → Outreach Sent → Interviewing → Offer/Rejected), shift-click to go back
- **Quick Links vault**: save your LinkedIn, portfolio, GitHub, etc. as labeled links — click any one to copy it instantly for application forms, edit or delete anytime
- **Dashboard**: total tracked, active count, interviewing-or-further count, response rate, a pipeline breakdown chart, and applications-by-day chart
- **Search + filter** by company, title, location, or stage
- **Installable PWA**: add to your phone/desktop home screen and use it like a native app
- **Works offline** after first load (basic service worker caching)
- **Private by default**: all data lives in your browser's `localStorage` — nothing leaves your device, no account, no backend

## Deploy to GitHub Pages
1. Push this folder to a GitHub repo (or a `docs/` folder / `gh-pages` branch of an existing repo)
2. In the repo, go to **Settings → Pages**
3. Under **Source**, pick the branch and folder this code lives in (root, or `/docs`)
4. Save — GitHub will give you a URL like `https://yourusername.github.io/job-hunt-hq/`
5. Open that URL, then use your browser's "Add to Home Screen" / "Install App" option to install it as a PWA

## Data & privacy
Everything is stored in `localStorage` in your browser, scoped to the domain you host it on. That means:
- Your data stays on the device/browser you use it in — nothing is sent anywhere
- Switching browsers or devices means a fresh, empty tracker (no sync between them)
- Clearing your browser data will erase your tracked jobs

If cross-device sync ever becomes something you want, the natural upgrade path is swapping `localStorage` for Supabase (Postgres) — auth, a `jobs` table, and a few fetch calls. Not included here to keep this simple and dependency-free.

## Tech
Plain HTML/CSS/JS, [Chart.js](https://www.chartjs.org/) via CDN for the dashboard charts. No build step, no framework, no npm install — just static files.
