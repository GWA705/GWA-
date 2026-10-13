# SMS opt-in disclosure & toll-free verification pack

Everything needed to (a) collect compliant text-message consent on the Home Depot
lead card, and (b) pass **Twilio toll-free verification** for **1-866-840-2789**.

The opt-in wording is the single most-rejected part of toll-free verification, so
this is written to tick every required element: who's texting, what they'll get,
message frequency, "msg & data rates may apply", STOP/HELP, that consent isn't a
condition of service, and links to the program terms + privacy policy.

> Contact details and formatting follow `docs/BRAND-KIT.md` §2 (web/`tel:` copy
> uses **hyphenated** numbers; the public program page is **portal.ghsbarrie.ca/sms**;
> privacy at **portal.ghsbarrie.ca/privacy**). Do not use the old 761 Bayview Dr address.

---

## 1. Opt-in disclosure for the Home Depot lead card (print)

Place this next to a **tick box** wherever the customer writes their phone number
(in-store card, mail-in card, and the online request form). The tick box is what
makes the consent explicit and auditable.

**English**

> ☐ **Yes — text me about my water assessment.**
> By giving your mobile number and ticking this box, you agree that Home Depot Home
> Services, serviced by Georgian Water & Air, may **call and text** you about the free
> in-home water assessment you requested, including appointment scheduling and
> reminders. Message frequency varies. **Message and data rates may apply.** Reply
> **STOP** to opt out or **HELP** for help at any time. Consent is not required to
> receive your assessment. Terms & privacy: portal.ghsbarrie.ca/sms

**French (Québec cards)**

> ☐ **Oui — envoyez-moi des textos au sujet de mon évaluation de l'eau.**
> En fournissant votre numéro de téléphone mobile et en cochant cette case, vous
> acceptez que Home Depot Home Services, assuré par Georgian Water & Air, communique
> avec vous **par téléphone et par texto** au sujet de l'évaluation de l'eau à domicile
> gratuite que vous avez demandée (prise de rendez-vous et rappels). La fréquence des
> messages varie. **Des frais de messagerie et de données peuvent s'appliquer.**
> Répondez **STOP** (ARRÊT) pour vous désabonner ou **HELP** (AIDE) pour de l'aide en
> tout temps. Le consentement n'est pas requis pour recevoir votre évaluation.
> Conditions et confidentialité : portal.ghsbarrie.ca/sms

**One-line version** (if space is tight — the full terms then live on /sms):

> ☐ Text me about my assessment. Home Depot Home Services / Georgian Water & Air may
> call & text you about your request. Msg frequency varies; msg & data rates may apply.
> Reply STOP to opt out, HELP for help. Not required to receive service.
> Terms: portal.ghsbarrie.ca/sms

## 2. Web disclosure

The public program page **portal.ghsbarrie.ca/sms** already carries the full
disclosure (who's texting, why, how you signed up, what to expect, msg & data rates,
STOP/HELP/START, contact block, privacy link). Give Twilio **this URL** as the opt-in
web evidence. The matching "How you signed up" consent section was added to that page
on 2026-10-13.

---

## 3. Twilio toll-free verification — field-by-field answers

Submit under **Messaging → Regulatory Compliance → Toll-Free Verification** for
+1 866 840 2789 (add it to your account first — see `docs/LEAD-AUTOTEXT.md` §"Turning
it on"). Rollout starts **Barrie only**; the use case is the same regardless.

| Field | What to enter |
|---|---|
| Legal business name | Your registered entity (the company behind georgianwaterandair.ca / ghsbarrie.ca — use the exact legal name on your business registration). |
| Business website | https://georgianwaterandair.ca |
| Business address | 10 - 11 King Street, Barrie, Ontario L4N 6B5 |
| Business contact | Sean Jaiko · sean@ghsbarrie.ca · 705-812-0320 |
| Use-case category | **Customer Care** (transactional — appointment/service follow-up; NOT marketing). |
| Use-case summary | "Appointment and service follow-up for in-home water-test requests. When a customer requests a free in-home water test through a Home Depot in-store lead card, mail-in card, or online form, we text to acknowledge the request and coordinate a callback to book. Transactional only. Every message identifies the sender and includes STOP opt-out." |
| Sample message 1 | *(the live welcome text)* "Hi [Name], it's Home Depot Home Services (serviced by Georgian Water & Air). We got your request for a free in-home water test at [address]. A team member will call within 24-48 hrs to book a time. Our call shows as \"HD Home Services\". Msg & data rates may apply. Reply STOP to opt out. Info: portal.ghsbarrie.ca/sms" |
| Sample message 2 | *(day-1 reminder)* "Hi [Name], a quick reminder from Home Depot Home Services about your free in-home water test. We'll call soon to book — or reply with a day and time that works. Reply STOP to opt out. Info: portal.ghsbarrie.ca/sms" |
| Opt-in type | **Point of sale / in-person + paper form** (also online form). |
| Opt-in description | "Customer completes a Home Depot lead card (in-store or mail-in) or an online form requesting a free in-home water test, provides their mobile number, and ticks a text-updates box. The disclosure beside the box states they may receive calls/texts, from whom, that message & data rates may apply, that message frequency varies, how to opt out (STOP), that consent is not required for service, and links to the program terms & privacy policy." |
| Opt-in evidence (URLs/images) | **1)** portal.ghsbarrie.ca/sms (full program terms + the "How you signed up" consent statement). **2)** A photo/scan of the Home Depot lead card showing the §1 disclosure beside the tick box. |
| Est. monthly volume | Your honest estimate for the Barrie rollout (e.g. "~X leads/day × up to 3 texts each"). Round up a little. |
| Opt-out & help | Handled automatically: STOP/ARRÊT opts out; HELP/AIDE returns name + contact; START/OUI re-subscribes (`/api/sms/inbound`). |

### The six elements a reviewer checks (all covered above)
1. Brand/sender identified — ✅ "Home Depot Home Services, serviced by Georgian Water & Air"
2. Message types described — ✅ assessment confirmation + scheduling reminders
3. Message frequency — ✅ "Message frequency varies"
4. Rates disclosure — ✅ "Message and data rates may apply"
5. Opt-out / help — ✅ "Reply STOP to opt out or HELP for help"
6. Terms + privacy links — ✅ portal.ghsbarrie.ca/sms (+ /privacy linked from it)

Plus the CTIA nicety: **"Consent is not required to receive your assessment."**

---

## 4. Nice-to-have (optional)
- The card/text links point to **portal.ghsbarrie.ca/sms**. If you'd prefer a
  customer-friendlier **georgianwaterandair.ca/sms**, set up a redirect on the
  marketing site/DNS to the portal page and update the URL everywhere (text
  template Info link, the card disclosure, and Twilio). Not required for approval.
- Typical approval time is **1–3 weeks**. Rejections are almost always the opt-in
  evidence — if it bounces, re-check that the lead-card photo clearly shows the §1
  wording beside the tick box, then resubmit (resubmission is faster).
