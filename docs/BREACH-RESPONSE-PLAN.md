# Privacy breach response plan — Georgian Water & Air

**Scope:** any suspected or confirmed breach of personal information held by
Georgian Water & Air, including through the Dealer Portal (portal.ghsbarrie.ca),
its database (AWS RDS, ca-central-1), file storage (AWS S3), email, and the
texting system.

**Legal basis:** Canada's **PIPEDA** (mandatory breach reporting since Nov 1, 2018)
and, for Québec residents, **Law 25** (confidentiality incidents). This plan is an
operational SOP, **not legal advice** — items marked `[TO CONFIRM]` need your
Privacy Officer and legal counsel to finalize, and counsel should be looped in on
any real incident.

---

## 1. Key definitions

- **Breach (PIPEDA: "breach of security safeguards"):** the loss of, unauthorized
  access to, or unauthorized disclosure of personal information resulting from a
  failure of safeguards or any other cause. (Québec Law 25 calls this a
  "confidentiality incident.")
- **Personal information we hold:** name, phone, email, home address; and for
  financing applicants, highly sensitive data — **SIN, date of birth, banking
  details, government ID numbers, income, proof of home ownership** — plus call
  recordings, texts and case notes.
- **Real Risk of Significant Harm (RRSH):** the PIPEDA test that triggers mandatory
  notification. "Significant harm" includes identity theft, financial loss, fraud,
  negative credit impact, humiliation, reputational damage, loss of
  employment/business opportunity, and bodily harm. "Real risk" weighs **(a) the
  sensitivity** of the information and **(b) the probability** it will be misused.
  > Because we hold SIN / banking / ID, a breach involving those fields will almost
  > always meet RRSH. Treat any breach touching them as notifiable unless counsel
  > advises otherwise.

## 2. Breach response team & roles

| Role | Who | Responsibility |
|---|---|---|
| **Privacy Officer (lead)** | `[TO CONFIRM — name, phone, email]` | Owns the response; makes the RRSH call with counsel; signs off on notifications. |
| **Technical lead** | `[TO CONFIRM]` | Contains the breach in the portal/AWS; preserves evidence; pulls the audit log. |
| **Management / owner** | Sean Jaiko `[confirm]` | Decisions on scope, external help, customer communication. |
| **Legal counsel** | `[TO CONFIRM — firm/contact]` | Advises on RRSH, notification wording, regulator contact. |
| **Communications** | `[TO CONFIRM]` | Customer/partner (Home Depot) messaging. |

Everyone who handles personal information must know: **if you suspect a breach,
report it to the Privacy Officer immediately — do not wait, investigate quietly,
or try to fix it alone.**

## 3. The response — five phases

### Phase 1 — Detect & report internally (minutes)
- Anyone noticing a possible breach notifies the **Privacy Officer** right away
  (`[TO CONFIRM contact]`), by phone if possible.
- The Privacy Officer opens an **incident record** (Appendix A) and starts a
  timeline: when, how discovered, what systems/data may be involved.
- Do **not** delete anything — preserve logs and evidence.

### Phase 2 — Contain & preserve (first hours)
Stop the bleeding and lock down. In the portal/AWS, as applicable:
- [ ] **Revoke access:** disable/suspend the affected user account(s); if staff
      credentials may be compromised, force password resets and **invalidate
      sessions** (rotate `SESSION_SECRET`).
- [ ] **Rotate secrets** that may be exposed: `MASTER_ENCRYPTION_KEY` / KMS key,
      `TWILIO_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, Google service-account key,
      database credentials, AWS keys. (Rotate first, investigate second.)
- [ ] **Isolate:** if the app or server is compromised, take it out of service or
      block the source (CloudFront/WAF, security groups).
- [ ] **Preserve evidence:** export the relevant **`AuditLog`** rows (logins,
      `PII_DECRYPT`, document views, `DATA_ACCESS`/`DATA_ERASURE`, exports), AWS
      CloudTrail/RDS/S3 access logs, and any emails. Snapshot RDS if useful.
- [ ] Note the time of each containment action in the incident record.

### Phase 3 — Assess the risk (RRSH) (promptly, in parallel)
Determine scope and whether notification is required. Document the answers:
- **What data?** Which fields, how many individuals, which provinces (flags Québec
  Law 25). Sensitivity: SIN/banking/ID = high.
- **What happened?** Lost/stolen/accessed/disclosed; still exposed or contained;
  encrypted or plaintext. (Our most sensitive fields are encrypted — if they stayed
  encrypted and keys weren't exposed, probability of misuse is lower.)
- **Who got it / could get it?** A trusted insider vs. an unknown external actor.
- **RRSH decision:** With counsel, decide if the breach creates a real risk of
  significant harm. Record the reasoning. **When in doubt, notify.**

### Phase 4 — Notify (as soon as feasible, if RRSH)
If RRSH is met:
- [ ] **Office of the Privacy Commissioner of Canada (OPC)** — report using the
      OPC's breach report form (priv.gc.ca), **as soon as feasible**.
- [ ] **Affected individuals** — notify directly (phone/email/letter) as soon as
      feasible, in clear language. The notice must include: what happened, when,
      what information was involved, what we're doing about it, what they can do to
      protect themselves (e.g., credit monitoring, fraud alert, change passwords),
      and how to reach us / the Privacy Officer. (Template: Appendix B.)
- [ ] **Québec residents?** Also notify the **Commission d'accès à l'information
      (CAI)** and affected persons under Law 25, and log it in the incident register.
- [ ] **Other organizations** that could reduce the risk — e.g., the financing
      company, a credit bureau, law enforcement, **Home Depot** (partner), and your
      **cyber-insurer** `[TO CONFIRM]`, as advised.

### Phase 5 — Record & review (after)
- [ ] Finalize the **incident record**; keep it. **PIPEDA requires retaining records
      of *all* breaches — even minor ones that didn't meet RRSH — for 24 months**,
      available to the OPC on request. (Law 25 requires a register of confidentiality
      incidents.)
- [ ] **Post-incident review:** root cause, what safeguard failed, and concrete
      fixes (code, config, process, training). Add action items to
      `docs/GO-LIVE-HARDENING.md` and track them to done.

## 4. Timelines at a glance

| Step | Target |
|---|---|
| Internal report to Privacy Officer | Immediately on discovery |
| Containment started | Within hours |
| RRSH assessment | Promptly, in parallel with containment |
| OPC report + individual notice (if RRSH) | **As soon as feasible** (no fixed day count, but delay must be justifiable) |
| Record retention | **24 months** minimum (PIPEDA); Law 25 register ongoing |

## 5. Contact sheet (fill in before you need it)

- Privacy Officer: `[TO CONFIRM — name, mobile, email]`
- Management/owner: Sean Jaiko `[confirm contact]`
- Legal counsel (privacy): `[TO CONFIRM]`
- Cyber-insurance / breach hotline: `[TO CONFIRM]`
- IT/technical (AWS, portal): `[TO CONFIRM]`
- OPC (federal): 1-800-282-1376 · priv.gc.ca
- Commission d'accès à l'information du Québec (CAI): cai.gouv.qc.ca
- Home Depot program contact: `[TO CONFIRM]`
- Financing company contact(s): `[TO CONFIRM]`

---

## Appendix A — Incident record (copy per incident)

- Incident ID / date opened:
- Discovered by / how / when:
- Systems involved (portal / RDS / S3 / email / texting / other):
- Data involved (fields) + est. # of individuals + provinces:
- Was the data encrypted? Keys exposed? (Y/N + detail)
- Cause (lost device / phishing / misconfig / insider / external attack / other):
- Containment actions + timestamps:
- RRSH decision + reasoning + who decided + date:
- Notifications made (OPC / individuals / CAI / others) + dates:
- Root cause + corrective actions + owners + due dates:
- Status (open/closed) + date closed:

## Appendix B — Individual notification letter (template)

> Dear [Name],
>
> We are writing to let you know about a privacy incident that may have involved
> some of your personal information. **What happened:** [brief, plain description]
> on/around [date]. **Information involved:** [list the fields]. **What we've done:**
> [containment + fixes]. **What you can do:** [specific steps — e.g., watch for
> suspicious activity, place a fraud alert / credit freeze, change passwords, contact
> your bank]. We take the protection of your information seriously and apologize for
> this. If you have questions, contact our Privacy Officer at [name / phone / email].
> You also have the right to contact the Office of the Privacy Commissioner of Canada
> (1-800-282-1376).
>
> Sincerely, Georgian Water & Air

---

_Review this plan at least annually and after any incident. Keep the contact sheet
current. This is an operational aid, not legal advice._
