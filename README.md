# Grimoire Intelligence — Deployment Guide

## Stack
- **Next.js 14** — framework
- **Supabase** — database + magic link auth
- **Anthropic Claude** — AI counsel + tarot
- **Vercel** — hosting

## You Need 3 Things

| Service | Get keys from | Cost |
|---|---|---|
| [Anthropic](https://console.anthropic.com) | API Keys | Pay per use |
| [Supabase](https://supabase.com) | Project Settings → API | Free tier |
| [Vercel](https://vercel.com) | Auto-generated on deploy | Free tier |

---

## Step 1 — Supabase

1. Create new project at supabase.com
2. **SQL Editor → New query** → paste `lib/supabase/schema.sql` → Run
3. **Settings → API** → copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`
4. **Authentication → Email** → enable **Email OTP** (magic links)

## Step 2 — Push to GitHub

```bash
git init
git add .
git commit -m "init: grimoire intelligence"
# Create repo on github.com, then:
git remote add origin https://github.com/YOUR_NAME/grimoire.git
git branch -M main
git push -u origin main
```

## Step 3 — Deploy on Vercel

1. vercel.com → **Add New Project** → Import your GitHub repo
2. **Environment Variables** — add these before deploying:

```
ANTHROPIC_API_KEY               = sk-ant-...
NEXT_PUBLIC_SUPABASE_URL        = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJ...
SUPABASE_SERVICE_ROLE_KEY       = eyJ...
NEXT_PUBLIC_APP_URL             = https://your-app.vercel.app
```

3. **Deploy** — done.

## Step 4 — Update Supabase Auth URL

After Vercel gives you a URL:
1. Supabase → **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel URL
3. Add to **Redirect URLs**: `https://your-app.vercel.app/auth/callback`

## Local Dev

```bash
npm install
cp .env.local.example .env.local
# Fill in keys
npm run dev
```

---

## Adding Payments Later (Paddle — works in Philippines)

1. Sign up at paddle.com
2. Create $7/mo subscription product
3. Install: `npm install @paddle/paddle-js`
4. Add `PADDLE_API_KEY` and `PADDLE_WEBHOOK_SECRET` to env vars
5. In `GrimoireApp.tsx` change `isPro={true}` to `isPro={user.isPro}`
6. Wire up Paddle checkout in a new `/api/paddle-webhook` route

Everything is already structured for this — flip one line when ready.
