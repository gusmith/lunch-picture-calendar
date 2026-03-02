# Lunch Calendar — Setup Guide

This guide walks you through deploying the app from scratch.
No prior Cloudflare experience needed — each step is numbered.
Estimated time: 30–45 minutes.

---

## What you will have at the end

```
Cloudflare Access (OTP login — your 2 Fastmail addresses)
    └── Cloudflare Pages  (hosts index.html)
            └── Cloudflare Worker  (API layer)
                    ├── Cloudflare R2   (stores photos)
                    └── Cloudflare D1   (stores date/SHA metadata)
```

---

## Step 1 — Create a Cloudflare account

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up with your Fastmail email address (either one works).
3. No domain is needed — Cloudflare provides free `.pages.dev` and `.workers.dev` subdomains.

---

## Step 2 — Create the R2 bucket (photo storage)

1. In the Cloudflare dashboard, click **R2 Object Storage** in the left sidebar.
2. Click **Create bucket**.
3. Name it exactly: `lunch-photos`
4. Leave all other settings as default.
5. Click **Create bucket**.

---

## Step 3 — Create the D1 database (metadata)

1. In the left sidebar, click **D1 SQL Database**.
2. Click **Create database**.
3. Name it: `lunch-calendar`
4. Click **Create**.
5. Copy the **Database ID** shown at the top of the page — you will need it in Step 7.

The table will be created automatically in Step 7 using `schema.sql` — no need to paste SQL manually.

---

## Step 4 — Set up the GitHub repository

Your repo is public, so we never put secrets or URLs directly in the code.
The Worker URL is injected at build time via an environment variable.

1. Create a GitHub repository (e.g. `lunch-calendar`).
2. Push all files to the `main` branch. The expected structure is:

```
lunch-calendar/
├── index.html
├── worker.js
├── wrangler.toml
└── .github/
    └── workflows/
        └── deploy-worker.yml
```

---

## Step 5 — Get a Cloudflare API token

GitHub Actions needs a token to deploy the Worker on your behalf.

1. In the Cloudflare dashboard, click your profile icon (top right) → **My Profile**.
2. Click **API Tokens** → **Create Token**.
3. Click **Use template** next to **Edit Cloudflare Workers**.
4. Leave defaults, click **Continue to summary** → **Create Token**.
5. **Copy the token now** — it is shown only once.

Also grab your **Account ID**:
- Go to the main dashboard — it is shown in the right sidebar under **Account ID**.

---

## Step 6 — Add secrets to GitHub

1. In your GitHub repository, go to **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** and add these two secrets:

| Secret name              | Value                       |
|--------------------------|-----------------------------|
| `CLOUDFLARE_API_TOKEN`   | The token from Step 5       |
| `CLOUDFLARE_ACCOUNT_ID`  | Your Account ID from Step 5 |

---

## Step 7 — First Worker deployment (manual, one time only)

Before connecting Pages to GitHub, the Worker needs to exist so you can get its URL.

**Install Node.js** (if not already): https://nodejs.org → LTS version.

```bash
npm install -g wrangler
wrangler login
```

Then in the repo folder:
1. Open `wrangler.toml` and replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with the ID from Step 3.
2. Commit and push that change.
3. Run once locally to create the Worker:
   ```bash
   wrangler deploy
   ```
4. Wrangler prints a URL like:
   `https://lunch-calendar-worker.YOUR_SUBDOMAIN.workers.dev`

   **Save this URL.**

After this first deploy, all future deploys happen automatically via GitHub Actions when you push to `main`.

---

## Step 8 — Connect Cloudflare Pages to GitHub

1. In the Cloudflare dashboard, click **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorise Cloudflare to access your GitHub account.
3. Select your `lunch-calendar` repository.
4. Click **Begin setup**.
5. Fill in:
   - **Project name**: `lunch-calendar`
   - **Production branch**: `main`
   - **Build command**: `sed -i 's|%%API_BASE%%|'"$API_BASE"'|g' index.html`
   - **Build output directory**: `/`
6. Click **Environment variables** and add:

   | Variable name | Value                                                            |
   |---------------|------------------------------------------------------------------|
   | `API_BASE`    | `https://lunch-calendar-worker.YOUR_SUBDOMAIN.workers.dev`       |

   Use the Worker URL you saved in Step 7.

7. Click **Save and Deploy**.

Every push to `main` now triggers an automatic deployment. The Worker URL is injected
into `index.html` at build time by Cloudflare — it never appears in your public repo.

---

## Step 9 — Restrict the Worker to your Pages site (recommended)

Since the repo is public, lock the Worker's CORS to accept requests only from your Pages URL.

1. Open `worker.js`.
2. Find:
   ```js
   const ALLOWED_ORIGIN = '*';
   ```
3. Replace with your Pages URL:
   ```js
   const ALLOWED_ORIGIN = 'https://lunch-calendar.pages.dev';
   ```
4. Commit and push → GitHub Actions deploys the Worker automatically.


---

## Step 10 — Set up Cloudflare Access (login protection)

This puts a login gate in front of your site so only your 2 accounts can access it.

1. In the Cloudflare dashboard, click **Zero Trust** in the left sidebar.
   - If prompted, create a Zero Trust organisation name (e.g. `family`). It's free.
2. Click **Access** → **Applications** → **Add an application**.
3. Choose **Self-hosted**.
4. Fill in:
   - **Application name**: Lunch Calendar
   - **Session duration**: 1 month (so you don't get asked to log in often)
   - **Application domain**: `lunch-calendar.pages.dev`
5. Click **Next**.
6. Under **Policy name**, type: `Family only`
7. Under **Include**, choose **Emails** and add both Fastmail addresses:
   - `your.email@fastmail.com`
   - `partner.email@fastmail.com`
8. Click **Next** → **Add application**.

Now when you visit `https://lunch-calendar.pages.dev`, Cloudflare will ask for your email.
It will send a 6-digit code to your Fastmail inbox. Enter it → you're in.

The session lasts 1 month, so you won't need to log in often.

---

## Step 11 — Test the app

1. Visit `https://lunch-calendar.pages.dev`
2. Enter one of your Fastmail addresses when prompted.
3. Check your inbox for the 6-digit code.
4. Enter the code → you should see the calendar.
5. Click a weekday → add a photo using camera or gallery.
6. Verify it appears as a thumbnail.
7. Click the thumbnail → lightbox should open.
8. Repeat from the other device (phone / other parent) to verify sync.

---

## Troubleshooting

**"Could not load photos — check API_BASE config"** banner on the page
→ The `API_BASE` constant in `index.html` has not been set yet. Follow Step 7.

**Photos upload but don't appear after refresh**
→ Make sure the D1 table was created correctly (Step 3). You can check via the D1 Console.

**Camera does not work on mobile**
→ The browser requires HTTPS. Cloudflare Pages always uses HTTPS, so this should work.
→ On iPhone, use Safari (Chrome on iOS does not support camera access in web apps).

**"This photo was already saved for..."**
→ This is expected — the SHA duplicate check is working correctly.

---

## File structure reference

```
lunch-calendar/
├── index.html                          ← Frontend
├── worker.js                           ← Cloudflare Worker API
├── wrangler.toml                       ← Worker config
├── schema.sql                          ← D1 database schema
├── package.json                        ← Dev scripts
└── .github/
    └── workflows/
        └── deploy-worker.yml           ← Auto-deploy Worker on push
```

---

## Local development

Everything runs locally with no cloud connection. Wrangler emulates
R2 and D1 on your machine using local files.

### First time setup

```bash
npm install
npm run setup:db   # creates the local SQLite database from schema.sql
```

### Every day

```bash
npm run dev
```

This starts two processes at once:

| Process | URL | What it does |
|---------|-----|--------------|
| Wrangler (Worker) | http://localhost:8787 | API, local R2 + D1 emulation |
| Static server (frontend) | http://localhost:3000 | Serves index.html |

Open http://localhost:3000 in your browser.
The app automatically talks to localhost:8787 when it detects it is running locally.

There is no Cloudflare Access gate locally — you go straight to the calendar.

### Local data

Wrangler stores local R2 and D1 data in  inside the project folder.
This folder is gitignored — your local test photos never go to GitHub.

Add this to your  if not already there:

```
.wrangler/
node_modules/
```

### Camera on localhost

Browsers block camera access on plain HTTP. To test the camera locally:

**Option A — use Chrome with a flag (easiest):**
1. Open 
2. Add  to the list and enable it.
3. Relaunch Chrome.

**Option B — use Firefox:** Firefox allows camera on localhost by default. No config needed.

**Option C — test on your phone:**
1. Find your computer's local IP: run  (Windows) or  (Mac/Linux).
2. Open  on your phone (both must be on the same Wi-Fi).
3. Phones require HTTPS for camera — so gallery upload will work but live camera won't on a phone locally. Use gallery import for phone testing.

### Applying schema changes

If you ever modify , re-run:

```bash
npm run setup:db
```

For production D1, run:

```bash
wrangler d1 execute lunch-calendar --file=schema.sql
```

---

## Phase 2 — Food recognition (future)

When ready, food recognition can be added by:
1. Signing up for a food recognition API (e.g. Clarifai or Edamam — both have free tiers).
2. Adding a new Worker route `POST /api/recognise/:date` that fetches the photo from R2 and calls the API.
3. Storing the results in a new D1 table.
4. Adding a "Year in food" summary page to `index.html`.

All of this stays within the Cloudflare ecosystem — no Google required.
