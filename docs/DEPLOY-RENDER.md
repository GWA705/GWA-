# Deploy your portal to the web (beginner guide)

This puts your app online at a real web address using **Render**, connected to
your **GitHub** repo. Every time the code changes on GitHub, Render updates the
site automatically. No terminal/commands needed.

> ⚠️ **Test data only.** This free setup stores data in the US and uploaded
> files are not kept permanently. It's for you and your team to try the app.
> **Do not enter real customer SINs or banking info yet.** Real customer data
> needs the Canadian-region production setup (see `docs/DEPLOYMENT.md`) and the
> legal steps in `docs/COMPLIANCE.md`.

## What you need
- Your GitHub account (you already have this — the code is there).
- 10 minutes.
- A free Render account (you'll make it in Step 1).

## Step 1 — Create a Render account
1. Go to **https://render.com**.
2. Click **Get Started** → **Sign in with GitHub**.
3. Approve the access request from Render.

## Step 2 — Start a new Blueprint
1. In the Render dashboard, click the **New +** button (top right).
2. Choose **Blueprint**.
3. Find and select your repository: **GWA705/GWA-**.
   - If you don't see it, click **Configure account / Connect a repository** and
     give Render permission to see the `GWA-` repo, then come back.

## Step 3 — Pick the branch
1. When asked which **branch** to deploy, choose:
   **`claude/pci-credit-application-portal-vi7d6r`**
2. Render will detect the `render.yaml` file automatically and show two things
   it will create: a **web service** (`gwa-portal`) and a **database** (`gwa-db`).
3. Give the blueprint any name (e.g. "GWA Portal") and click **Apply** /
   **Create**.

## Step 4 — Wait for it to build
- Render now installs, builds, and starts the app. This takes **~3–5 minutes**.
- You'll see logs scrolling. When the web service shows **"Live"** (green), it's
  ready. (The database is created automatically — you don't configure anything.)

## Step 5 — Open your site and sign in
1. Click the web service (`gwa-portal`). Near the top you'll see its address,
   like **`https://gwa-portal.onrender.com`**. Click it.
2. You'll land on the sign-in page. Log in with a sample account:

   | Role | Email | Password |
   |---|---|---|
   | Admin | `admin@gwa.example` | `ChangeMe!Admin123` |
   | Reviewer | `reviewer@gwa.example` | `ChangeMe!Review123` |
   | Dealer | `dealer@barrie.example` | `ChangeMe!Dealer123` |

3. Try it end-to-end: log in as the **Dealer** and submit a test application
   (use fake info!), then log in as the **Reviewer** to approve it.

That's it — your portal is live on the internet. 🎉

## Good to know
- **It auto-updates.** Any future code change pushed to that branch redeploys
  automatically.
- **Free plan sleeps.** After ~15 min of no use, the free site "spins down" and
  the next visit takes ~30–60 seconds to wake up. Normal for testing. Upgrading
  the web service to a paid plan (~US$7/mo) keeps it always-on.
- **Free database expires in ~30 days.** Fine for trying it out. For anything
  ongoing you'll upgrade the database.
- **Change the sample passwords** if you share the link with anyone: sign in as
  Admin → **Users**, or ask me to change them.

## When you're ready for REAL customer data
Don't use this staging site for that. The real launch needs:
1. Lawyer-reviewed consent + privacy wording (`docs/COMPLIANCE.md`).
2. A Canadian-region deployment with proper key management (`docs/DEPLOYMENT.md`).
3. Ideally a security review.

Ask me and I'll help you plan that step, or prepare a brief for an IT contractor.

## If something goes wrong
- **Repo not listed in Step 2:** Render → Account Settings → GitHub permissions →
  grant access to the `GWA-` repo.
- **Build failed:** open the web service → **Logs**, copy the red error lines,
  and send them to me — I'll tell you the fix.
- **Site loads but login fails:** the database may still be finishing its first
  setup; wait a minute and refresh.
