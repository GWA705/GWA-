# ID & document scanning — how it works + how to turn on the OCR

The New-customer form has an **Auto-fill this application** bar with two scanners.
This doc explains what each needs and the one AWS step to enable the OCR parts.

## The two scanners

| Button | What it reads | Needs AWS? |
|---|---|---|
| **Scan driver's licence** | The **PDF417 barcode** on the **back** of the licence, decoded **in the browser** (AAMVA). Exact fields, image never leaves the device. | **No** — works on its own. |
| ↳ licence *front-photo* fallback | If no barcode reads, the licence **front** via Textract **AnalyzeID**. | Yes (Textract) |
| **Scan a filled credit app** | A photo / single-page PDF of a completed Financeit application via Textract **AnalyzeDocument** (forms OCR). Image processed in memory, **not stored**. | **Yes (Textract)** |

Until Textract is enabled, the two AWS-backed paths return
`{ ok:false, reason:'not_enabled' }` and the UI says *"Reading uploaded documents
isn't turned on yet — enter the details manually."* The **licence barcode scan
still works** with no AWS.

## Turn on the OCR (one-time AWS step)

The app authenticates to AWS as the IAM user **`gwa-portal-app`** (the same one
used for S3 — its key is `AWS_ACCESS_KEY_ID` in Render) and calls Textract in
`S3_REGION` = **`ca-central-1`**.

1. AWS Console → **IAM → Users → `gwa-portal-app` → Add permissions → Create
   inline policy → JSON**, paste:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["textract:AnalyzeDocument", "textract:AnalyzeID"],
         "Resource": "*"
       }
     ]
   }
   ```
   Name it e.g. `gwa-portal-textract`, save.
2. That's it — **no redeploy needed** (same credentials; the permission applies
   immediately). Re-test **Scan a filled credit app** on the form.

### Region notes
- **AnalyzeDocument** (the *credit-app* scanner) **is available in
  `ca-central-1`** — so the main feature works with the step above.
- **AnalyzeID** (the licence *front-photo* fallback) is offered in fewer regions
  and may **not** be in `ca-central-1`. If that call errors, the licence still
  works via the on-device **back-barcode** scan. To make the front fallback work,
  AnalyzeID must run in a supported region (e.g. `us-east-1`); ask a dev to add a
  `TEXTRACT_REGION` override (not wired yet — small change) if you need it.

## Good to know
- **Cost:** Textract AnalyzeDocument ≈ US$0.05 per page (Forms). AnalyzeID similar.
- **Single page:** synchronous Textract reads one page. Upload a **photo** or a
  **single-page PDF** of the application; multi-page PDFs need the async flow
  (not built).
- **Privacy:** neither route stores the image — it's read in memory and
  discarded. The barcode path never uploads the image at all.
- **Code:** `src/app/api/scan-doc/route.ts` (AnalyzeDocument),
  `src/app/api/scan-id/route.ts` (AnalyzeID), `src/components/DocScan.tsx`,
  `src/components/LicenseScan.tsx`, `src/lib/aamva.ts`, `src/lib/autofill.ts`.
