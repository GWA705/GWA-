# Turning on email (SMTP) — step by step

The portal has email built in. Until SMTP is configured it runs in **log-only**
mode (it records what it *would* send to the server log and sends nothing). Once
you add the SMTP settings below, it sends for real. No code change or code
deploy on your part is needed — just environment variables in Render.

Nothing sensitive (SIN, banking, ID) is ever put in an email — emails link back
to the portal instead.

---

## What emails the portal sends
- Password reset links
- Status updates on a deal (submitted / approved / funding / funded, etc.)
- New note / new document notifications
Each recipient's per-type preferences are respected (see their profile).

---

## Step 1 — Pick the mailbox to send from (Google Workspace)
Use a real Google Workspace mailbox on your domain, e.g. a shared/group address
like `team@ghsbarrie.ca` or `hello@ghsbarrie.ca`.

1. That mailbox must have **2-Step Verification** turned on
   (admin.google.com may need to allow it for the account).

## Step 2 — Create an App Password
An App Password is a 16-character code Google issues so an app can sign in
without your real password.

1. Sign in to that mailbox → visit **Google Account → Security**.
2. Under **How you sign in to Google**, open **2-Step Verification** (turn it on
   if needed).
3. At the bottom, open **App passwords**.
4. Create one (name it "GWA Portal"). Google shows a **16-character code** —
   copy it. You'll paste it as `SMTP_PASS`. (Remove the spaces; it's fine either
   way, but no spaces is cleanest.)

> If you don't see "App passwords", 2-Step Verification isn't fully on yet, or a
> Workspace admin policy is blocking it. A Workspace admin can enable it.

## Step 3 — Add the settings in Render
Render → your service (**gwa-portal**) → **Environment** → add these, then
**Save** (Render redeploys automatically):

```
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = team@ghsbarrie.ca        ← the mailbox that signs in
SMTP_PASS = <the 16-char App Password>   ← type it directly; never screenshot it
```

Optional (you can also set these in the portal — see Step 5):

```
EMAIL_FROM       = team@ghsbarrie.ca   ← the group address emails come FROM
EMAIL_FROM_NAME  = GWA Dealer Portal   ← the display name dealers see
EMAIL_REPLY_TO   = team@ghsbarrie.ca   ← where replies go (defaults to EMAIL_FROM)
```

> **From vs. sign-in:** the simplest setup is to make `EMAIL_FROM` the **same**
> address as `SMTP_USER`. If you want a *different* From address, it must be
> added as a **"Send mail as"** alias on the sign-in mailbox in Gmail, otherwise
> Google rewrites the From line to the sign-in address.

## Step 4 — Confirm it's on
1. In the portal, sign in as an **admin** and open **Email** in the top nav.
2. The badge should read **Sending** (green). If it still says **Log-only**, the
   SMTP variables aren't all set yet (or the redeploy hasn't finished).
3. Use **Send a test email** to your own inbox. Check the inbox and the spam
   folder. If it arrives, email is working.

## Step 5 — Set who emails come from (in the portal, no redeploy)
On the same **Email** admin page, the **"Who emails come from"** box lets you set:
- **From name** — the display name (e.g. "GWA Dealer Portal").
- **From address** — the group address emails are sent from.
- **Reply-To** — the group address replies go to (leave blank to reuse the From
  address, so replies come back to the whole team).

These override the Render values above and take effect immediately.

---

## Who a dealer sees the email from
Dealers receive email **from** the From name + From address (e.g.
`GWA Dealer Portal <team@ghsbarrie.ca>`). When they hit reply, it goes to the
**Reply-To** group address — so any team member on that group can pick it up.

## Troubleshooting
- **Badge still "Log-only":** one of `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` is
  missing, or the redeploy is still running.
- **Test says "Could not send":** usually a wrong App Password, or the mailbox
  doesn't allow App Passwords. Re-create the App Password and re-paste it.
- **Email arrives but From looks wrong:** `EMAIL_FROM` isn't the sign-in mailbox
  and isn't a verified "Send mail as" alias — add the alias in Gmail or set
  `EMAIL_FROM` to the sign-in mailbox.
- **Goes to spam:** add SPF/DKIM for your domain in Google Workspace (Workspace
  admin → Apps → Google Workspace → Gmail → Authenticate email). This is a
  domain DNS setup, done once.
