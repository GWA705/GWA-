# GWA Dealer Portal — Changelog & operational status

The running record of **what's been shipped** and **what operational config is
live**, newest first. This is durable project memory: Claude reads it (and
`BUILD-FACTS.md`) at the start of work and appends to it when shipping, so past
work and go-live steps aren't forgotten between sessions.

Dates are the day the work landed on the production branch
(`claude/pci-credit-application-portal-vi7d6r`). Git history is the authoritative
source of truth; this file is the human-readable index.

> **How to keep this useful:** when a change ships, add a dated bullet. When an
> integration goes live or an env var / external config changes (Render, DNS,
> Google, S3, a third-party API), update the **Operational status** table below
> with the date and who confirmed it — that's the stuff that otherwise only
> lives in a dashboard and gets forgotten.

## Operational status (live integrations & external config)

| Thing | Status | Notes |
|---|---|---|
| Sales journal (Google Sheets) | ✅ Connected in Render | `JOURNAL_SHEET_ID` + Google service-account creds set. Auto-writes on approval and whenever deal numbers change. Confirmed live in Render 2026-09-03 (Sean). |
| Email (SMTP) | ✅ Live | Sends from `hello@ghsbarrie.ca`. |
| Domain email auth (SPF / DKIM / DMARC) on `ghsbarrie.ca` | ✅ Set | SPF `include:_spf.google.com`; DKIM authenticating (Google Workspace); DMARC `p=quarantine`. Confirmed 2026-09-03 (Sean). |
| Guusto gift-card API | ⏳ Parked | Awaiting `GUUSTO_API_TOKEN` in Render + exact field names (test at `/admin/guusto-test`) + office→reason mapping. |
| Bilingual UI toggle (EN/FR) | ✅ **Live in production** (2026-09-06, Sean) | `NEXT_PUBLIC_I18N_ENABLED=1` set on the `gwa-portal` service. Visible to ALL dealers on portal.ghsbarrie.ca. fr-CA coverage (draft) now spans the **full dealer app AND the full staff/reviewer app** — including the report views, reviewer decision/funding forms, and the deal "what's needed" items + funding-doc type labels (all translated 2026-09-06). Still English **by design**: the internal admin console; the in-app Tutorial (on hold); the verbatim Consumer Protection Act consent text (Québec team supplies the FR); and a few low-traffic residual staff strings (staff gift-cards page, the mail-attachment viewer, one or two report-wrapper labels). Set the var back to `0` (and redeploy) to hide the toggle again. |
| AI support assistant (chat) | ✅ **Live** (2026-09-07, Sean) — `ANTHROPIC_API_KEY` set in Render | Always-on Claude assistant on the General support thread (`src/lib/ai.ts`). Dedicated Anthropic key "Portal.ghsbarrie.ca" (Default workspace) so its cost tracks separately from the booking site's `gwa-booking` key. Model = default `claude-haiku-4-5-20251001` (override with `ANTHROPIC_MODEL`). Assistant stays quiet for 30 min after a human reply; falls back to the static after-hours note if the key is ever removed/out of quota. |
| DeepL translation (user content) | ✅ Live (2026-09-06) — `DEEPL_API_KEY` set in Render (free "API Developer" key) | Powers (a) the on-demand Translate control and (b) the **automatic** FR→EN conversion of chat, deal-conversation and gift-card threads, and dealer free-text notes on the reviewer side (`<AutoTranslate>`). **Free fallback:** if DeepL is missing or out of quota, translation auto-switches to MyMemory (free, no account; set `MYMEMORY_EMAIL` to lift its daily cap). **Usage meter:** Admin → System health shows DeepL characters used / limit. |
| Bell Total Connect voicemail | 📝 Documented, not built here | Guide delivered for the **booking site** (voicemail-to-email + IMAP). Not part of this portal. |

### French lead parsing — BUILT, awaiting live paste + test
- **French Home Depot lead parsing (Québec/French leads).** The portal only
  *reads* the "HD Leads Log" Google Sheet; HD lead emails are parsed into it by
  Sean's **external Apps Script** (`scripts/hd-leads-automation.gs`). Root cause
  of missed French leads: the Gmail search required the English subject, and the
  parser keyed off English labels only. **Fixed 2026-09-06 from a real French
  sample (Réf 701780675):** the search now matches the EN subject OR the FR
  fragment "Services à domicile" (same sender, info@homedepot.ca), and
  `parseLead()` is bilingual (EN|FR for every field — see the script header for
  the label map); French leads log as "Format F (French)". **Remaining step
  (Sean, external):** paste the updated `processNewLeads()` search line +
  `parseLead()` into the LIVE Apps Script and run `testSingleLead()` on a French
  lead to confirm before the 15-min trigger runs. Portal display already
  auto-translates lead free-text via DeepL. (2026-09-06, Sean.)

## 2026-09-07
- **Chat assistant: reliable replies + "trainable" knowledge + cost estimator.**
  Three changes: (1) **Reliability** — the assistant reply now comes from a
  dedicated `POST /api/chat/assistant` the widget awaits, instead of a
  fire-and-forget task that a redeploy could drop; the send route just saves the
  message. (2) **Knowledge / "train it like me"** — richer built-in portal facts,
  plus an **admin-editable "team knowledge"** textbox (Admin → System health,
  saved to `AppSetting` `ai.assistantKnowledge`) injected into the system prompt
  as authoritative, so staff can teach the assistant answers/policies in their own
  words with no deploy. Prompt also re-tuned to give real steps and stay in the
  team's voice. (3) **Cost estimator** — an interactive card on System health
  estimating monthly Anthropic cost by model (Haiku 4.5 / Sonnet 5 / Opus 5) from
  editable volume + token assumptions.
- **Auth: EN/FR language toggle on the login (and all auth) pages.** Pre-login
  pages only followed the saved locale cookie, so a dealer landing in the "wrong"
  language had no way to switch until after signing in. Added a shared
  `(auth)/layout.tsx` that shows the `LanguageToggle` (top-right, gated by
  `I18N_UI_ENABLED`) on login, forgot/reset password, MFA and 2FA-setup.
- **Reports: fixed two stacked navy blocks + new tab style.** The monthly
  summary card sat right under the navy "My reports" hero as a second big navy
  block, so the two read as one heavy mass. The summary is now a **light KPI
  card** (white, icon chip, big navy numbers, coloured MoM) — clearly distinct
  from the hero. The report tabs became a **segmented control** (Option A): a
  tinted track with the active tab as a raised white thumb, scrolls horizontally
  for the owner's 7 tabs. Both theme-aware. (Summary card is shared with the staff
  monthly report, which gets the same cleaner look.)
- **Mobile: tapping a field no longer zooms the page (iOS).** iOS Safari
  auto-zooms when a focused input's font is under 16px, which happened on the chat
  box and other fields. Added a phone-scoped rule forcing form controls to 16px
  (`max-width:640px`), so focusing the chat message box / any input no longer
  jumps the zoom. Desktop keeps its compact fields.
- **Mobile: support chat moved into the bottom quick bar (in place of Mail).**
  The quick bar's last tab is now **Help** (chat icon) which opens the support
  chat directly, so support is always one tap away without a floating bubble.
  Mail stays reachable via the header bell and the hamburger menu. On phones/
  tablets with the quick bar on, the floating chat bubble is now hidden (chat is
  in the toolbar); it still shows on desktop (no quick bar there) and if a dealer
  turns the quick bar off. New `quickBar.help` key (EN "Help" / FR "Aide").
- **Chat bubble no longer interferes with the document viewer.** The in-app PDF/
  image viewer (`DocViewer`) is a full-screen overlay that shared the chat
  launcher's `z-50`, so the bubble floated over the PDF and could grab taps
  (glitchy Back/scroll). The viewer now emits a `gwa:overlay` open/close signal
  that the chat widget listens for (counter-based, nesting-safe) and hides the
  bubble while any viewer is open; the viewer was also raised to `z-[60]` as a
  backstop.
- **Dashboard: visual upgrade of the three insight cards** (desktop + mobile).
  *Applications by Status* is now a crisp SVG donut (rounded segments with a soft
  gap, track ring, big centred total) with a cleaner legend (count + muted %).
  *Applications This Month* becomes a proper chart — dashed gridlines, gradient
  rounded bars with a soft shadow, a baseline, responsive bar widths.
  *Program Breakdown* gets an icon-chip header, gradient bars on a track, and
  count·% on the row. Shared card style (softer border, layered shadow, more
  padding), theme-aware, with subtle grow-in intros (disabled under
  reduced-motion). No data/logic changes — presentation only.
- **Mobile: chat bubble no longer covers page buttons.** The floating chat
  launcher sat over primary actions at the bottom of long pages (e.g. "Submit
  app" on the New Application form). It now auto-hides (fades/slides out) once the
  reader scrolls to the bottom of any scrollable page — where Submit/Save buttons
  live — and returns as they scroll back up; still hidden on the dashboard, which
  has its own support card. Works site-wide, no per-page config.
- **Chat: real-time assistant feel.** After a dealer sends in the support thread,
  the widget shows a live "✨ Assistant is typing…" indicator and fast-polls
  (~1.5 s) so the reply appears in about a second or two instead of on the 6 s
  cycle; it stops the moment the reply lands (or after a 25 s safety timeout).
- **Chat: AI support assistant (always-on, with human takeover).** The General
  support thread now answers dealers automatically with Claude (Anthropic
  Messages API, called from `src/lib/ai.ts` — no SDK dependency). It's grounded
  in a portal-facts system prompt, replies in the dealer's language, and is
  guard-railed: it never invents customer/deal/credit/dollar specifics or makes
  binding promises, and defers those to the team. It stays silent for 30 min
  after a real teammate replies, so a person can take over; a staff reply always
  wins. Runs in the background after the dealer's message is saved (send stays
  instant; the reply lands on the widget's ~6 s poll) and only on `SUPPORT`
  threads (deal threads still go to the reviewer). Assistant/auto messages render
  as a left "✨ Assistant" bubble. Falls back to the static after-hours note when
  the AI is unavailable. **Requires `ANTHROPIC_API_KEY` in Render** (optional
  `ANTHROPIC_MODEL`, default `claude-haiku-4-5-20251001`); without it, behaviour
  is the after-hours note only. Also fixed the auto-message author label
  (was "GWA Portal" → "Assistant") to respect the brand naming rule.
- **iOS: branded launch splash for the installed app.** Added
  `apple-touch-startup-image` launch screens (blue tile + centred icon) for the
  common iPhone resolutions, wired via `appleWebApp.startupImage` in the root
  layout. Opening the installed app now shows the brand instead of a white flash,
  matching Android (which already uses the manifest icon + `background_color`).
  Assets in `public/splash/` (PNG, per Apple's requirement); portrait, one per
  device size. Android/desktop unaffected.
- **Perf: hero/banner images converted to WebP.** The dashboard hero, the
  time-of-day rotation, and every page banner were ~2 MB PNGs each, so first
  paint pulled megabytes on every dealer screen. Re-encoded to WebP at ≤1920px /
  q80 — **92–97% smaller** (total hero payload ~34 MB → ~2 MB), references
  updated, PNG originals removed, and the static-image cache window lengthened
  (`max-age` 10 min → 1 h, SWR 1 day → 1 week). The runtime hero scanner already
  accepts `.webp`, so the daily/hourly rotation is unchanged.
- **Chat: after-hours auto-reply.** When a dealer sends a message outside
  9am–9pm (America/Toronto), the thread gets an automated acknowledgement
  ("Our team is offline right now (9 PM–9 AM) … we'll reply as soon as we're
  back"), stored in the dealer's language and rendered as a centred **system
  note** (amber, not a person's reply). Posted at most once per burst until a
  human actually replies. Schema: `ChatMessage.auto` flag + nullable `authorId`
  (migration `20260907010000_chat_auto_reply`, applied on deploy by
  `scripts/start.sh`). Support hours are defined in `src/lib/chat.ts`.
- **Mobile: support-chat button no longer hidden behind the Leads map.** The
  Leaflet map gives its own panes/controls a high `z-index` (up to ~1000), and
  the map wrapper created no stacking context, so those escaped into the page and
  painted over the fixed chat launcher (`z-50`) and the quick bar. Added
  `isolate` (isolation: isolate) to the map wrapper so Leaflet's z-index stays
  contained to the map box; the chat button and quick bar sit above it again.
- **Mobile: dealer "quick bar" (hybrid bottom navigation), toggleable per
  device.** Added a fixed bottom shortcut bar for dealers on phones/tablets
  (`DealerBottomNav`, hidden at `lg` where the sidebar takes over) with the five
  everyday actions — Home, Deals (Applications), a raised **New** button in the
  centre, Leads, Mail — with active-tab highlighting and unread dots pulled from
  the same nav array the shell builds. The hamburger drawer is **kept** as the
  full menu; the quick bar is an additive shortcut layer, not a replacement. It
  can be switched **on/off from a toggle in the mobile menu** (default on);
  preference is stored per device in `localStorage` (`gwa-quickbar`) and syncs
  live between the toggle, the bar, the page's bottom padding, and the support
  chat launcher (which lifts above the bar on phones). New `useQuickBar` hook +
  `quickBar.*` dictionary keys (EN/FR). Staff/admin unchanged (desktop-primary).
- **Mobile: dealer Applications "Pipeline" view no longer clips on phones.** The
  kanban was a fixed 880px 4-column grid inside a horizontal scroller, so on a
  phone the left column was cut off (stray amounts bleeding off-screen) and card
  text truncated. Now the pipeline **stacks stages vertically on phones**
  (full-width, nothing clipped) and keeps the horizontal kanban at `md`+. Also
  tightened card truncation (name/program get `min-w-0` so they ellipsize cleanly
  instead of overflowing). Extracted shared `PipelineCard` / `StageColumn` so both
  layouts stay in sync.
- **New home-screen / PWA app icon.** Replaced the install / Add-to-Home-Screen
  icon with the new GWA app tile (maple leaf + Canada map + GWA + wave, supplied
  by Sean). Regenerated `public/icon-192.png`, `icon-512.png` and
  `apple-touch-icon.png` (180) full-bleed — the source's black corners are
  trimmed so phones apply their own rounding cleanly — plus a padded
  `public/icon-maskable-512.png` now wired as the manifest's `maskable` icon so
  Android's circle/squircle mask never clips the wordmark. Source art saved at
  `public/brand/gwa-app-icon.png`; recorded in Brand Kit §3.
- **PWA install splash + chrome now brand blue.** `manifest.ts`
  `background_color` changed from white to `#1d4ed8` (brand-600, matching
  `theme_color` and the new app icon), so the launch/splash screen and the
  standalone window chrome match the icon instead of flashing white.
- **Mobile: fixed the root cause behind top-bar buttons ignoring their
  show/hide breakpoints.** The `.topbar-btn` class (`@apply inline-flex …`) was
  defined as plain CSS *after* `@tailwind utilities` and outside `@layer
  components`, so its `display:inline-flex` beat Tailwind's own `hidden` /
  `lg:hidden` / `sm:inline-flex` utilities (equal specificity, later in source
  wins). Every top-bar button therefore ignored its responsive display classes —
  the **sidebar-collapse toggle leaked onto phones** (showing next to the
  hamburger, which is desktop-only), the hamburger itself didn't hide at `lg`,
  and the theme toggle's `hidden sm:inline-flex` showed on mobile. Wrapped
  `.topbar-btn` in `@layer components` so the utilities win again; all three now
  toggle correctly. (`.card`, `.badge`, `.label` were checked for the same
  latent bug — `.card` sets no `display`, and `.badge`/`.label` are never paired
  with a responsive display utility, so no other visible toggle was affected.)
- **Mobile: header no longer truncates to "De…" on phones.** The dealer and
  staff top bars crowded the portal-name text between the logo and the right-hand
  controls, clipping it to "De…". The wordmark block (portal name + "GEORGIAN
  WATER & AIR" eyebrow) is now hidden below `sm` — the logo tile already carries
  brand identity on a phone — and given `min-w-0`/`truncate` so it ellipsizes
  cleanly rather than overflowing at any width. Part of a whole-site mobile pass:
  audited every dealer flow — all responsive grids start `grid-cols-1/2` on
  phones and only widen at `sm`/`lg`, and every wide table already scrolls inside
  its own `overflow-x-auto`, so the Pipeline kanban and this header were the only
  structural mobile breaks.

## 2026-09-06
- **Translation: live health check + Google Translate as a dormant provider.**
  Added a one-click **Live translation test** on Admin → System health (translates
  a known French phrase and reports which provider answered) via a server action —
  on-demand so it doesn't spend quota on page load. Extended the provider chain to
  **DeepL → Google → MyMemory**: Google Cloud Translation is wired in but dormant
  until `GOOGLE_TRANSLATE_API_KEY` is set in Render — switching to it later is just
  adding the key, no code change. Added `providerLabel()` for diagnostics.
- **Translation: usage meter + free fallback provider.** `src/lib/translate.ts`
  now runs a provider chain — DeepL first, then **MyMemory** (free, no account)
  automatically when DeepL is unconfigured, out of quota, or unreachable — so
  reviewer translation keeps working without a paid plan (long text is chunked to
  fit MyMemory's per-query limit; set `MYMEMORY_EMAIL` to raise its free daily
  cap). Added `deeplUsage()` (characters used vs. plan limit) and a **Translation
  usage** card on **Admin → System health** with a used/remaining bar that warns
  as the DeepL credit runs low and notes the automatic free fallback. Every
  translation caller goes through `translateText`, so the fallback is portal-wide.
- **Brand logo assets added.** Committed the Georgian Water & Air logo lockups
  (supplied by Sean): `public/GWANewLogo.png` (primary horizontal, transparent) +
  organized copies in `public/brand/` (horizontal-with-divider, and a circular
  badge for avatar/favicon use). Updated `docs/BRAND-KIT.md` §3/§12 to record the
  on-file rasters; vector (SVG/EPS) and a true reverse (white-on-dark) lockup are
  still outstanding. Used the primary logo on the greyscale Bilingual Launch
  Readiness Review PDF (the logo is the only colour element, per the §4 interim
  rule).
- **Bilingual coverage — file drop-zone (shared upload control).** Translated
  the drag-and-drop `FileDropInput` (drop prompt, Choose-file button, format
  hint, photo-optimizing state, "N files ready", "Click to change") — the last
  shared control on the dealer upload path still in English. New `fileDrop`
  namespace; default `hint`/`buttonLabel` now fall back to localized copy while
  still overridable per caller. This closes the dealer + reviewer toggle: the
  only surfaces left in English are the admin console (`TopNav`/AppShell) and the
  printable `PayoutReceipt` (paperwork, English on purpose), plus the on-hold
  Tutorial and the verbatim consent legal text.
- **Bilingual coverage — reviewer verification checklist, split-payment
  breakdown, conversation thread.** Final staff stragglers (fr-CA draft): the
  reviewer **funding verification checklist** (`VerificationChecklist` — the four
  checks + help via a new `verificationChecklist` namespace keyed to the
  constants, plus all row chrome/states/buttons), the split-payment
  **PaymentBreakdown** (title, Financed/Paid badges, deal total, amount
  financed), and the staff **conversation thread** page (title, back/open links,
  the "sees you as Reviewer" note, composer placeholder). The check codes and
  written values stay English; labels display via keys.
- **Bilingual coverage — staff report page wrappers + hub.** Translated the
  remaining staff report shells: the **Reports hub** card grid (`staffReportsHub`
  — 7 card titles/blurbs, badges, hub chrome; badge strings stay English as
  filter keys and localize only at render), and the office/month/week selector
  wrappers for **monthly**, **weekly store detail**, **dealer snapshot**,
  **product & package pricing**, plus the staff **Find a customer** search page.
  New `staffReports` + `staffReportsHub` namespaces (reusing `reports.*`
  month/week/view keys); month/week dropdown labels now format in the viewer's
  locale. With this the staff toggle is complete apart from the admin console.
- **Bilingual coverage — staff/reviewer surfaces, part 3 (shell, mail,
  conversations, misc).** Finished the staff-side sweep (fr-CA draft): the
  **staff shell/nav** (`StaffShell`, reusing the shared `nav.*`/`shell.*` keys,
  plus a small `staffShell` namespace), the **Mail** list + thread + compose
  (`staffMail`, `staffMailThread`, `mailCompose`), **Conversations** index
  (`staffConversations`), the GWA-team **customer detail** page
  (`staffCustomerDetail`), the **journal-connection** diagnostics report
  (`connectionReport`), and the staff **leads** oversight page (reusing dealer
  `leads.*` keys + a small `staffLeads` namespace). Staff-typed content (mail
  subject/body), machine values, env-var names/URLs, and data values stay
  English; fixed "GWA" brand slips (sender label, headers). With this the
  EN/FR toggle has no remaining English islands on the dealer or staff surfaces
  (admin console and the on-hold Tutorial excepted).
- **Bilingual coverage — staff/reviewer surfaces, part 2 (reviewer forms).**
  Translated the reviewer action forms on the staff deal page (fr-CA draft):
  the **decision** form (`DecisionForm` — options via `decisionDisplayLabel`,
  approve/finance fields, notes), the customer **confirmation** call script +
  checklist (`ConfirmationForm`), the **payout** form (`PayoutForm`), the manual
  **status change** control (`StatusChangeForm`, reusing the existing
  `enum.status.*` labels), and the reviewer **workspace** shell
  (`ReviewerWorkspace` — flow/tabs layout, phase tags, action banners). New
  `decisionForm`, `confirmationForm`, `payoutForm`, `statusChangeForm`,
  `reviewerWorkspace` namespaces. All machine values written to the deal record
  (decision/status/enum codes, amounts, confirmation numbers, reviewer-typed
  notes) stay English; only visible chrome is localized.
- **Bilingual coverage — staff/reviewer surfaces, part 1.** Began the staff-side
  sweep (fr-CA draft) for a fully bilingual toggle: the **reviewer queue**
  (`ReviewerQueue` — view modes, columns, tabs, priority bands, pager, empty
  states), the reviewer **funding checklist** (`FundingChecklist` — states,
  buttons, localized funding-doc type names via the shared helper), and three
  leadership reports — **weekly snapshot**, **dealer snapshot**, **cycle times**.
  New namespaces `reviewerQueue`, `fundingChecklist`, `weeklySnapshot`,
  `dealerSnapshot`, `cycleTimes`. Money/number/date formatting, journal data
  values, and status codes stay English; fixed "GWA" brand slips in report
  eyebrows/labels. (Staff are English-speaking; this is completeness work so the
  site has no English islands when toggled to FR.)
- **Bilingual coverage — deal-detail "what's needed" + funding-doc labels
  (dealer).** Closed the last dealer-facing gap: `dealerOutstanding()` now takes
  a translator and returns localized to-dos (fix-problem, add-serials,
  upload-{doc}, ready-to-submit) for the deal page "What's needed from you" card
  and the applications-list "Action needed" chip. Added a display-only
  `fundingDocTypeLabel` helper (`enum.fundingDocType.*`) + `outstanding`
  namespace; the dealer deal-detail funding checklist now shows localized
  document-type names. The English `constants.ts` labels stay the source of
  truth for reviewer counts, exports and any record. Fixed a "GWA" brand slip in
  the submit-package prompt.
- **Bilingual coverage — shared dealer components (upload, product picker,
  doc viewer).** Translated the file **upload form** (`UploadForm` — category
  prompt, "describe it", the no-payment-cards warning, submit/clear states), the
  **product picker** (`ProductPicker` — search, "Other" free-text, "add to my
  list" opt-in, empty state), and the in-app **document viewer** (`DocViewer` —
  Back/Download, PDF loading + render-error fallback). New `uploadForm`,
  `productPicker`, `docViewer` namespaces. Form field names, submitted product
  names, and the printable **payout receipt** (`PayoutReceipt`) stay English
  (data-write / paperwork).
- **Bilingual coverage — more dealer surfaces (forms, account, library, misc).**
  Translated to fr-CA (draft): the resource-library **brand/sort filters**
  (`LibraryFilters`); the **sales-rep report** page date-range control and the
  **weekly report** week-range dropdown (now locale-formatted); the **Find a
  customer** all-offices view (GWA-team) plus the "your office" fallback; the
  **mail attachment viewer**; the **date-of-birth** picker (`DateOfBirthInput`,
  incl. month names); the **split-payment** input (`SplitPaymentInput`, reusing
  the shared `paymentMethodLabel` display helper); the **product-package
  builder** inside pricing (`ManualPackageBuilder`); and the account-page
  **Install app** (PWA) and **desktop-notification** controls. New `dob`,
  `splitPayment`, `installApp`, `desktopNotifications`, `manualPackage`
  namespaces plus additions to `resources`, `reports`, `findCustomer` and `mail`.
  Data-write paths stay English (submitted DOB value, payment-method enum
  values, money formatting). Fixed brand slips ("GWA Portal" → "Georgian Water
  & Air Portal").
- **Bilingual coverage — reporting views (dealer + reviewer).** Translated the
  shared report components to fr-CA (draft): the **monthly performance** report
  (`MonthlyReportView`), **weekly store detail** (`StoreWeekView`), **by sales
  rep** (`SalesRepReport`), **product & package pricing** (`ProductPricingReport`),
  **sales forecast** (`SalesForecastView`) and the **custom report builder**
  (`CustomReportBuilder`) — headers, stat tiles, table column headers, hints,
  empty states, buttons and footnotes. New `reports.monthly`, `storeWeek`,
  `salesRepReport`, `productPricing`, `salesForecast` and `customReport`
  namespaces; the dealer weekly page also localizes its week-range dropdown.
  Data-write paths stay English on purpose: money/number formatting, the CSV
  export headers and filenames, and the custom builder's group-by dimension
  labels (which double as CSV headers). Also fixed brand slips ("GWA HD" →
  "Georgian Water & Air") in the monthly/weekly report eyebrows.
- **Bilingual coverage — Find a customer (dealer).** Translated the dealer
  "Find a customer" surface to fr-CA (draft): the `FindCustomerPanel` hero
  (title, subtitle with `{company}`, the My customers / Whose customer mode
  toggle, mode-specific placeholders and hints, Recent lookups + Clear, footer)
  and the shared `CustomerSearch` results (status/empty messages, result rows,
  the "other office has this customer" block, the journal detail card, and the
  inline customer-edit form). New `findCustomer` namespace. Office-scoped search
  behaviour and any values written back stay as-is; only display strings change.
- **HD Promotions hero slot.** Added a hero image slot for the HD Promotions
  content page — drop a file at `public/HD-Promotions.png` and it becomes the
  page banner; absent, it falls back to the gradient (same pattern as the HD
  Credit Card hero).
- **Mobile/tablet nav fix — no stray collapse button, no dead nav gap.** The
  sidebar collapse/expand toggle now only appears at `lg`+ where the persistent
  sidebar actually lives (it was showing where it made no sense on smaller
  screens). Fixed the underlying breakpoint mismatch: the hamburger drawer was
  hidden at ≥`sm` (640px) while the sidebar didn't appear until `lg` (1024px),
  leaving tablets (640–1023px) with no navigation at all. Added a `hideAt` prop
  to `MobileNav` (default `sm`, preserving AppShell's inline nav) and set the
  Dealer/Staff shells to `lg`, so below `lg` you get only the hamburger and at
  `lg`+ only the collapse toggle — never both.
- **Auto-translate chat & messages for reviewers (FR→EN, near-instant).** New
  `<AutoTranslate>` component converts each message to the viewer's interface
  language automatically on load — so an English reviewer reads a French dealer's
  message in English right away (and a French dealer reads English replies in
  French), with a subtle "show original" toggle. Wired into all message threads:
  the corner **chat widget**, the reviewer **deal conversation** thread, and the
  **gift-card** message thread. Cost/latency-aware: a client-side French-signal
  heuristic skips same-language text (no DeepL call), results are cached per
  (target, text) for the session, and DeepL's detected source suppresses the
  note when text was already in the viewer's language. Degrades silently with no
  key set, so it **activates for reviewers the moment `DEEPL_API_KEY` lands in
  Render — no redeploy needed**. Independent of the `NEXT_PUBLIC_I18N_ENABLED`
  UI-language flag. (`translateContent` now also returns DeepL's detected source.)
- **Support card — agent photo centred.** Moved the customer-support agent photo
  from the right edge to the centre of the support pill (symmetric two-sided
  feather) so the right-hand "Chat" button no longer clips it; lightened the
  colour wash so the centred photo reads clearly while the left text stays crisp.
- **Bilingual coverage — Leads (dealer, full surface).** Translated the entire
  Home Depot Leads surface to fr-CA (draft): the leads list (totals, search,
  status/outcome/month filters, list/grouped/map toggle, group headers, lead
  rows + all detail fields, no-good reason, pagination, empty states), the
  per-lead **call tracker** (outcome buttons, status pills, next-step chips,
  logged history), the **No-good** control (confirm flow + messages), the month
  dropdown, and the **map view** (store/lead popups, legend, loading + placement
  status). New keys live under the `leads` namespace; the shared
  `leadCallStatus` helper now takes an optional `t` (English fallback preserved).
- **Bilingual coverage — deal-detail page (dealer).** Translated the dealer
  deal-detail page to fr-CA (draft): header + "where your deal stands",
  customer snapshot, review decisions, confirmation, documents-for-approval,
  paperwork-for-customer, payout receipt, the whole funding-package section
  (legend, serials, per-document checklist, badges, submit), and the status
  history (via `enum.status`). New `dealDetail` namespace. Also localized two
  shared display helpers used here and on the staff deal page: the "where you
  stand" label (`dealerFacingStatusLabel`, keyed by reviewer-phase id →
  `dealerStatus.*`) and recorded-decision labels (`decisionDisplayLabel` →
  `enum.decision.*`). Still English (lib-driven, shared with staff/email paths —
  a later careful pass): the "what's needed" outstanding items and the
  funding-document type labels.
- **Deal enum labels — staff/reviewer display too (site-wide).** Extended the
  display-only enum layer to the staff surfaces: the reviewer queue (program +
  category columns), the staff deal-detail page (program badge, payment method),
  the reviewer entry/print view (program, SOAP), the split-payment breakdown
  (method labels), and the staff edit-deal form dropdowns. `t` is threaded into
  the shared `PaymentBreakdown`/`ReviewerEntryView` components as a prop.
  Careful exception: the edit page's *default product* value still comes from the
  **English** category label (`PROGRAM_CATEGORY_LABELS`) because it's written to
  the deal, not just shown. Enum labels are now localized everywhere they're
  displayed, dealer- and staff-side.
- **Bilingual coverage — deal enum labels (display-only layer).** Added a
  locale-aware **display** layer for the deal enums — program type/category,
  payment method, SOAP — as `enum.*` dictionary keys plus helpers in
  `src/lib/enumLabels.ts` (`programDisplayLabel`, `paymentMethodLabel`,
  `soapDisplayLabel`, …). Wired it into every **dealer-facing** display: the
  new-application dropdowns + payment picker, the dashboard program breakdown +
  recent deals, the applications list, the deal-detail page, and customer-search
  results. **The English `constants.ts` labels are deliberately untouched** and
  still back every data write — sales-journal columns, CSV/PDF exports, HD
  paperwork, emails — so records stay consistent regardless of the viewer's
  language. Staff/reviewer internal views (PaymentBreakdown, ReviewerEntryView,
  staff deal pages) will adopt the same helper when those surfaces are
  translated as a whole. `enum.programCategory.HVAC` → “CVC” in fr-CA.
- **Bilingual coverage — new-application form (the big one).** Translated the
  full "New customer processing" form to fr-CA (draft): the three entry-method
  cards (Express/Priority/Standard), payment-type picker, financing details,
  HD-lead pre-fill (incl. the live lookup status messages), deal + sales
  details, applicant/address/borrower-ID/employment sections, the co-applicant
  questionnaire, First Nations tax exemption, and the client-side error summary
  (field labels + "required"). New `newApplication` namespace (~130 keys). Select
  values are unchanged (labels display FR, submitted values stay the codes the
  backend expects). The legal **consent notice** (`CONSENT_TEXT`) is left
  verbatim per the brand kit — its fr-CA legal wording is for the Québec team to
  supply. Constant-driven option lists (program/category/payment/SOAP) still
  render their English labels for now — that shared enum layer is a separate pass.
- **Bilingual coverage — gift-cards surface (dealer).** Translated the full
  water-test gift-card flow to fr-CA (draft): the request form, per-request
  cards + inline edit, the dealer↔team message thread, search/filter controls,
  the pager, and the bulk-CSV importer (preview table, per-row validation
  messages, plural "added/skipped" counts). Expanded the `giftCards` namespace
  with ~70 keys. The downloadable CSV template now switches with the locale
  (French headers + filename when FR), and the importer accepts both English and
  French headers (accent-insensitive) so data-matching still works either way.
  Also fixed a brand slip in the
  message thread ("GWA team" → "Georgian Water & Air team").
- **Bilingual coverage — public "Request portal access" onboarding.** Translated
  the public `/request-access` page and its onboarding form to fr-CA (draft):
  access code, main contact, office details, people-who-need-a-login rows, and
  the confirmation state. New `onboard` dictionary namespace. Example data in
  placeholders (names, sample phone/postal) left as-is; descriptive labels and
  hints translated.
- **Bilingual coverage — sign-in / account-security screens.** Translated the
  entire `(auth)` surface to fr-CA (draft): login, forgot-password,
  reset-password, forced password change, two-factor verification (MFA), and
  two-factor setup/enrollment (email-code + authenticator-app tabs, QR, resend).
  New `auth` dictionary namespace. Still gated behind `NEXT_PUBLIC_I18N_ENABLED`.
- **Dealer journal-archive search (office-scoped history).** Dealers can now
  find their own office's past Home Depot customers from the **closed** sales
  journals (2024+) right in Find customer. The old journals are no longer edited,
  so they're **imported once into the database** (`JournalRecord` table +
  migration) and searched from there — fast, permanent, and correctable. New
  `scripts/import-journals.ts` reads each closed year via the existing journal
  reader, attributes every row to an office with the shared Dealer-Snapshot
  matcher (`src/lib/reporting/dealerMatch.ts`, store number → alias → distinctive
  name token), and upserts on `(year, tab, rowNum)` so re-runs refresh without
  duplicates. `searchOfficeJournalArchive()` (`src/lib/journalArchive.ts`) is
  **strictly scoped to the dealer's own `dealerId`** (no cross-office leakage),
  name/phone match, read-only. Results show as customer cards under "From your
  office's past sales journals" (avatar, year, product · store · finance · amount
  · sale date, phone/address). Going forward, run the import once per year as each
  book closes. **To go live:** run the import in production (dry-run first) —
  `npx tsx scripts/import-journals.ts --year=2024,2025 --dry`, then without
  `--dry`.
- **HD Payout Calculator — deal tool + printable receipt.** The "How the payout
  works" explainer now stays on the right at all times; the result breakdown
  renders under the inputs on the left (calculator layout unchanged). Portal deal
  search now returns full sale details (customer, sale date, products, sales rep,
  installer, payment method) shown in a refined customer-profile card, with a
  **Recent** quick-pick row remembered per browser. Added **Print receipt** — a
  print-friendly Dealer Sale & Payout Receipt (sale details + accounting
  breakdown) the dealer can attach to a sale or hand to accounting. Added hero
  slots: `/reports-hero.png` (My reports) and `/mail-hero.png` (Mail). Removed
  the "Sales & rewards" eyebrow from the Marketplace hero.

- **Resources & content-page cleanup.** Removed the white script flourish from
  the Resources index, Product library and Support heroes; fixed the **double
  banner** on the Resources page (the embedded section no longer renders its own
  hero); promoted **Product library** to a top-level sidebar item (out of the
  Resources submenu) and gave the resources index a proper prominent card for it.
  Tightened the shared content-card grid to 3-up on wide screens with
  full-preview (object-contain) thumbnails so document covers stop cropping oddly.
- **HD Payout Calculator beefed up.** Two-column layout on desktop (inputs left,
  results right) that fills the width, with a "How the payout works" panel shown
  until an amount is entered; added a hero image slot (`/calculator-hero.png`).
- **Brand fixes.** Replaced customer-facing "GWA" with "Georgian Water & Air" in
  the Resources blurb, the calculator note and its copied breakdown.

## 2026-09-05
- **Bilingual (EN/FR) foundation for the Québec launch.** Added a cookie-based
  i18n system (`src/i18n/`) — no route restructuring: `getLocale()`/`getT()` for
  server components, `<LocaleProvider>`/`useT()` for client, en + fr-CA
  dictionaries, a `setLocale` server action, and an **EN/FR toggle** in the top
  bar. The toggle is **hidden until `NEXT_PUBLIC_I18N_ENABLED=1`** in Render so
  real users don't see half-translated pages during the all-at-once rollout.
  First surfaces translated: the dealer shell (nav, top bar, mobile drawer) and
  the whole dashboard. Also added **DeepL** live translation for user-typed
  content (`src/lib/translate.ts` + `<TranslateText>`), gated on `DEEPL_API_KEY`.
  fr-CA copy is a **draft for the Québec team to review**; legal/statutory text
  is intentionally left for official French wording. *(Rollout continues across
  applications, forms, reports, staff & admin before the flag is turned on.)*
- **Right rail refresh.** Quick Actions swaps "Find a Lead" for **Gift cards**;
  a compact **HD Leads** pill now sits above the (slimmer) Support pill.
- **Dashboard & shell polish.** The dealer sidebar is now **collapsible** (toggle
  in the top-left; icon-only rail at 72px, state remembered per browser) so the
  content area can go wider. Added a **New application** button to the top bar.
  Sidebar links get a subtle **"water" hover** (caustic wash + light sheen,
  reduced-motion aware). Mobile dashboard KPIs are now a **compact 2-up grid**
  (smaller tiles that flow into the list). The **Support** card is slimmer (a
  single compact row, "Chat" button) so it doesn't read as a big call-out.
  **Recent Applications** stays at 4 rows collapsed and, when expanded (up to
  15), scrolls inside its own card so the page never gets pushed around.
- **Hero cleanup + HD Credit Card hero slot.** Removed the white script flourish
  from the **Leads** hero and from the shared **Resources** content heroes (it
  overlapped the photos / read as clutter). Added a per-slug hero image map in
  `ContentPage` so content tabs can carry their own banner; wired the **HD Credit
  Card** page to `/hd-credit-card-hero.png` (drop that file in `/public`).
  `ContentSectionView` now takes an optional `bgImage`.
- **Pricing report: unit counts + all products.** Added a "Products — sold /
  approved / installed" table (units per product across all deals; installed =
  installation date reached), and the "Group products your way" picker now lists
  **every active catalog product** (even zero-sales ones). The manual grouping
  result now shows Sold / Approved / Installed counts alongside the average.
  `productPricing` now scans all non-draft deals (averages still approved-only)
  and returns `productCounts` + full catalog.
- **Custom builder — more measures, group-bys & CSV.** Added an **Approval rate
  (%)** measure and three group-bys — **Payment method, Entry method, HD store** —
  plus an **Export CSV** button. `reportDataset` now carries paymentMethod,
  entryMethod, HD store number and an approved flag.
- **Save & name custom reports.** The custom report builder can now save a named
  view (measure + group-by + range + status filters) and reload or delete it.
  Saved reports are **office-shared** (any owner at that office sees them). New
  `SavedReport` model + additive migration `20260905020000_saved_report`; server
  actions `saveCustomReport` / `deleteCustomReport` (owner-gated).
- **By-sales-rep report (dealer owner).** `/dealer/reports/sales-reps`: each rep's
  deals, total and average sale value, plus their top program, with a date-range
  filter. Uses the salesperson name captured on the new-customer form
  (`Application.salespersonName`). Owner-gated.
- **Rotating dashboard hero.** Drop a few images into `public/hero/` and the
  dashboard shows a different one **each day** (deterministic; falls back to
  `public/hero-banner.png`, then the gradient). Combined with the existing
  time-of-day greeting (sunrise/sun/moon) so sign-in feels fresh without any
  external weather call. `lib/heroImage.ts`.
- **Sales forecasting centre (dealer owner).** `/dealer/reports/forecast`: 12-month
  trend, this-year-vs-last-year by month, and a **seasonal projection** for the
  next 3 months (each future month's historical average scaled by the recent
  12-month trend; trailing-3-month fallback). Clearly labelled as a directional
  estimate. `lib/reporting/salesForecast.ts` + `SalesForecastView`. Owner-gated.
- **Custom report builder (dealer owner).** A curated, tenant-isolated report
  builder at `/dealer/reports/custom`: pick a **measure** (deal count / total $ /
  average $), a **group-by** (month, program, status, salesperson, province,
  product), a **date range**, and **status filters** — live table + bar chart,
  computed in the browser over the office's own deals (`reportDataset`). Owner-
  gated (same as the pricing report). Save/name reports and sales forecasting are
  the next phases.
- **Pricing report: manual product grouping.** Tick products to see the average
  sale price when sold together, with "Exactly these" / "Includes these" match
  modes (`ManualPackageBuilder`).
- **Product & package pricing report.** Average sale price per product and per
  package, per office. Because a deal stores one total + a product list (no
  per-product price): a deal with **one** product feeds that product's average;
  a deal with **two or more** is a **package**, auto-grouped by the exact set of
  products (no hard-coded package list). Basis: approved-or-beyond deals, using
  the approved amount (falls back to requested). Two surfaces:
  **Staff** (`/staff/reports/product-pricing`, Reports area, gated by the
  Dealer-Snapshot grant) with an office picker (All / each office); and
  **dealer owner** (`/dealer/reports/product-pricing`) scoped to their own office.
  Dealer access is deliberately double-gated so the control is clear: the user
  must be the **office owner** (`User.isDistributor`) **and** the office's
  reports must be enabled by an admin (`Dealer.reportsEnabled`, the existing
  Admin → Dealers → "Reports" toggle) — regular office staff never see it.
  `lib/reporting/productPricing.ts`, `canViewOwnerPricingReport`,
  `ProductPricingReport`. No schema change.
- **Applications: multi-view deal tracker (dealer).** The Applications list is now
  a switchable workspace so dealers can track deals through approval → docs →
  funding the way that suits them: **Tracker** (grouped by "Needs your action" /
  "In progress — with GWA" / "Funded & paid" / "Closed"), **Pipeline** (Kanban
  columns by stage), **List** (the detailed sortable table), and **Progress** (a
  stage bar per deal). One search + sort drives all views; pins float to top.
  The chosen view is remembered per user (most-recent) and **usage is counted in
  the DB** (`ApplicationViewUsage`) so we can see which views dealers actually
  use. Stage/grouping logic in `lib/dealerStage.ts` (reuses `dealerOutstanding`);
  view logged via `/api/dealer/view-usage`. Replaces the old single table +
  separate "Needs attention" panel on this page. Migration
  `20260905010000_application_view_usage` (additive).
- **Reviewer (staff) area brought up to match the dealer portal.** New
  `StaffShell` gives the reviewer area the same dark-blue sidebar + white top
  header (slim scrollbar, Dealer-view switcher pill, mail bell, account block)
  as the dealer portal, replacing the old top-nav `AppShell` (content stays in a
  centered column). `SectionHero` now heads the main reviewer pages — Deals
  queue, Mail, Conversations, Gift cards, Directory, Find customer, Leads,
  Reports (with a "Journal connection" hero action). Admin area still on the old
  shell (next phase). UI-only; queue/search/sort/logic unchanged.

## 2026-09-04
- **Shared hero rolled across the dealer tabs.** Every dealer page now uses the
  reusable `SectionHero` (added an optional `actions` slot for header buttons and
  an `actions`/flourish right side; image is scaled to cover — never distorted —
  focused via `bgPosition` and feathered on the left so a banner photo blends
  into the gradient with no seam). Converted: Applications (with a "New customer
  processing" hero button), New customer, Leads ("Home Depot Leads"), Gift cards,
  Resources + Product library, HD Promotions / HD Credit Card (via
  `ContentSectionView`), Mail, Office profile, Request logins, HD Payout
  calculator, Find customer, Tutorial, Contact & Support. Swappable banner
  slots wired for `public/{leads,gift-cards,resources}-hero.png` (gradient
  fallback until uploaded).
- **Marketplace facelift (dealer).** New shared enterprise page hero
  (`SectionHero`, reusable across dealer tabs): blue gradient + swappable
  background photo (`public/marketplace-hero.png`), eyebrow/title/subtitle,
  feature tiles and a "Represent / Grow / Succeed / Together" script flourish.
  Categories are now big icon cards with counts; added a product search + sort
  (Featured / A–Z). On desktop the cart is a **persistent right rail** (with a
  "Need help with your order?" support card that opens the corner chat, plus
  Fast-processing / Dealer-exclusive / Questions tiles); mobile keeps the
  floating cart button + drawer. All order logic unchanged — still an
  order request, **no prices/checkout** (items carry no price in the system).
- **"Needs your attention" moved to the Applications page.** Off the dashboard;
  it now sits above the full Applications list (reviewer send-backs first,
  flagged red), where the dealer actually actions deals.
- **Dealer dashboard facelift — round 2.** Hero rebuilt as a wide photographic
  banner: swappable background photo (`public/hero-banner.png`, on-brand gradient
  until one is added), a **time-aware icon** on the greeting (sunrise / sun /
  moon-and-stars for morning / afternoon / evening) and a "Better Water /
  Brighter Lives" script flourish (Great Vibes web font). Header shows the
  dealer's own company logo + "Dealer Portal". Sidebar got a **slim on-brand
  scrollbar** (replacing the chunky native bar) and tighter spacing; the
  "Switch to Reviewer view" control moved up to a small top-bar pill beside the
  search. **Recent Applications** is now expandable (Show more/less), pinnable
  (per-user pins float to the top), and flags reviewer send-backs. New
  **"Needs your attention"** panel lists deals to action — reviewer send-backs
  (PROBLEM) first, flagged red with a "!". Support card made compact + shows a
  swappable agent photo (`public/support-agent.png`). UI-only.
- **Dealer dashboard facelift — refinements.** Header now shows the **dealer's own
  uploaded company logo** beside "Dealer Portal" (falls back to the Georgian
  wordmark when no logo is set). Hero rebuilt to the enterprise "Welcome to your
  Dealer Portal" treatment (line-art house + growth-arrow graphic, "Your hub for
  managing and organizing your business"); removed the four feature chips and the
  announcement banner under the hero. Support card ("Need Support?") now **opens
  the corner chat** on click (was a link to `/dealer/support`) and shows a
  swappable, auto-cropped agent photo from `public/support-agent.png` (headset
  watermark until one is added; AI image prompt in `BRAND-KIT.md` §13). Quick
  Actions "Process Application" → **"Product Resources"** (→ product library).
  `ChatWidget` listens for a `gwa:open-chat` event. UI-only; backend/routes/auth
  unchanged.
- **Dealer portal facelift (dashboard + shell).** New enterprise-style dealer
  UI: dark-blue left sidebar + white top header (`DealerShell`, reuses the
  existing mobile drawer), and a real-data dashboard at `/dealer` (hero with
  time-aware greeting + office name, KPI cards, Recent Applications preview,
  Quick Actions, Support card, and Status-donut / Monthly-trend / Program
  breakdown). The full searchable/filterable Applications list moved to
  `/dealer/applications` (logic unchanged; nav "Applications" points there,
  "Home" → `/dealer`). Reusable components under `components/dashboard/`; added
  `lucide-react`. Backend, routes, auth, permissions, forms unchanged;
  staff/admin unaffected. Self-contained commit — revert to restore the
  original look.
- **Animated header wordmark + dashboard greeting (dealer).** The header opens as
  "GWA Dealer Portal" and, once per browser session, softly blurs into
  "<Company> Portal" (company from the office profile) after ~5s. The dealer
  dashboard shows a time-aware "Good morning/afternoon/evening, <first name>".
  Falls back to "GWA Dealer Portal" when no company is set; respects
  prefers-reduced-motion. `AnimatedWordmark` + `DashboardGreeting`.
- **Card-number redaction in chat.** Card numbers typed into chat are stripped
  and replaced with "[card number removed]" server-side (raw number never
  stored); the message still goes through and the sender sees an amber notice.
  Length + Luhn detection, so the portal's own numbers (HD Customer #,
  financing #, phones) are untouched. `src/lib/cardGuard.ts` (+ tests).
- **Chat polish.** Fixed the chat auto-scroll stealing the whole page (it now
  scrolls only the message list, and only when you're already at the bottom).
  Removed the redundant inline "Chat with the Reviewer" section from the dealer
  deal page — the corner bubble covers it (the reviewer deal page keeps its
  inline chat).
- **Live chat (Phase 1 — polling).** Corner chat bubble on the dealer side
  (deal-aware + a General support thread, unread badge) and a reviewer
  **Conversations inbox** (`/staff/conversations`), plus a **Chat** nav item with
  an unread badge. Unified `Conversation`/`ChatMessage`/`ConversationRead` model
  (backfilled from existing dealer-facing deal notes); the deal page's inline
  chat (both sides) now reads/writes the same conversation, so bubble, inbox and
  deal page are one thread. Reviewer names show as "Reviewer" to dealers. Deal
  messages still fire the existing new-message notification. Near-real-time via
  polling; SSE + Postgres LISTEN/NOTIFY is the planned Phase 2 upgrade (no UI
  change). API: `/api/chat/{summary,messages,send,read}`. See
  `scratchpad/live-chat-architecture.md`.
- **Reviewer names hidden from dealers.** Dealer-facing surfaces now show
  **"Reviewer"** (with the timestamp) instead of an individual GWA staff name —
  review decisions, the deal chat/notes, the confirmation line, and mail
  (sender + staff replies). One shared constant `REVIEWER_DISPLAY` +
  `isInternalRole()`; `NoteThread`/`ConfirmationView` gained an `anonymizeStaff`
  prop (staff pages still show real names). Mail replies previously said "GWA" →
  now "Reviewer" too (unified).
- **"Review cycle times" admin report** (Reports → Review cycle times): time
  between each pipeline milestone from the status history — median/avg/90th %
  per task, GWA vs Dealer vs Total, selectable window.
- **New deal progress bar.** `DealProgress` is now variant-based: dealers see a
  **segmented progress bar** (Option 1 — filling segments, shimmer on the active
  stage, big % / step-of count); reviewers see a **milestone timeline** (Option 2
  — stage icons, completion dates from the status history, and a live "what's
  happening now" detail strip with an Auto-advances cue). Same real stages
  (Submitted → Approved → Docs uploaded → Confirmation → In for funding → Funded
  → Paid); off-path flags (Problem/Declined/Withdrawn) preserved. Motion respects
  `prefers-reduced-motion`.

## 2026-09-03
- **Deal numbers pin while the HD Customer # is missing.** When an approved deal
  still needs its HD #, the Review & decide step collapses but keeps the Deal
  numbers card pinned below it (Flow layout), so it can be finished without
  expanding the whole step; it disappears and the step collapses fully once the
  HD # is saved. (`ReviewerWorkspace` gained a `pinned` slot shown only while a
  phase is collapsed.)
- **Reviewer deal page — Decision moved into the tab.** Removed the right-hand
  Decision column; the decision, approval fields, and status controls now live at
  the top of the **Review & decide** tab (`ReviewerWorkspace` renders full-width
  when no rail is passed).
- **Sales journal auto-sync.** Shared best-effort `syncApplicationToJournal()`
  helper. Writes the journal row the moment a deal is **approved**, and re-writes
  the **same row** whenever the deal numbers change — so an HD Customer # added
  after approval fills in automatically. Manual "Write to Journal" button remains
  as a fallback/re-sync.
- **HD Customer # no longer blocks approval.** Approve on finance company + loan
  number; add the HD # afterward (it writes to the journal when added).
- **Rule: HD # required before install paperwork.** An HD-program deal must have
  its HD Customer # recorded before paperwork can be sent to the dealer (enforced
  in `uploadReviewerPaperworkAction`; the Produce-documents step shows an "add the
  HD Customer # first" notice until it's in).

## 2026-09-02
- **New-dealer intake → office directory.** Attaching an intake to a dealer (and a
  new "Fill directory" backfill on past intakes) now builds/refreshes that
  dealer's directory profile — office info, each person as a contact card, and the
  logo — non-destructively. Added `OnboardRequest.attachedDealerId`.
- **Website field on the intake form**, flowing through to the directory profile.
- **WhatsApp teaser flyers** (design canvas) — three "coming soon" portal-blue
  teasers with the `/request-access` link + code `GWA2026`.

## Earlier (pre-changelog — see git history + `BUILD-FACTS.md`)
- Leads Map (Leaflet + OpenStreetMap, background geocoding, admin store-location
  override); content end-dates + "ending soon" ribbon; public `/request-access`
  dealer intake (shared access code, office details, logo upload); go-live data
  reset (deals + mail, keep users); Dealer Portal invite email (portal-blue,
  mobile-responsive).
