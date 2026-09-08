# ID & document scanning — how it works + how to turn on the OCR

The New-customer form has an **Auto-fill this application** bar with two scanners.
This doc explains what each needs and the one AWS step to enable the OCR parts.

## The two scanners

| Button | What it reads | Needs AWS? |
|---|---|---|
| **Scan driver's licence** | A **photo of the FRONT** of the licence via Textract **AnalyzeID** — name, address, DOB, licence #. Image processed in memory, **not stored**. | **Yes (Textract, AnalyzeID region)** |
| **Scan a filled credit app** | A photo / single-page PDF of a completed Financeit application via Textract **AnalyzeDocument** (forms OCR). Image processed in memory, **not stored**. | **Yes (Textract)** |

> The on-device **PDF417 barcode** scanner (back of the licence, AAMVA) was
> **removed in 2026-09** — barcode reads weren't reliable enough. Licence scanning
> is now photo/OCR only.

Until Textract is enabled/available, the AWS-backed paths return
`{ ok:false, reason:'not_enabled' }` and the UI says *"…isn't switched on yet —
enter the details manually."*

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

### Region notes — IMPORTANT for the licence scan
- **AnalyzeDocument** (the *credit-app* scanner) **is available in
  `ca-central-1`** — so that scanner works with the IAM step above, no region change.
- **AnalyzeID** (the *licence photo* scanner) is offered in fewer regions and may
  **not** be in `ca-central-1`. If so, the licence scan reports *"isn't switched on
  yet"* until you point AnalyzeID at a supported region. Set **`TEXTRACT_ID_REGION`**
  in Render (e.g. `us-east-1`) and redeploy.
  - **Data residency:** picking a US region means the **licence image is processed
    in the US** (never stored, discarded after reading). Everything else stays in
    `ca-central-1`. If Canadian-only processing is required, leave the licence scan
    off until AWS offers AnalyzeID in `ca-central-1`.
  - The IAM policy already allows `textract:AnalyzeID` on `Resource: "*"`, so no
    policy change is needed for a different region.

## Good to know
- **Cost:** Textract AnalyzeDocument ≈ US$0.05 per page (Forms). AnalyzeID similar.
- **Single page:** synchronous Textract reads one page. Upload a **photo** or a
  **single-page PDF** of the application; multi-page PDFs need the async flow
  (not built).
- **Privacy:** neither route stores the image — it's read in memory and discarded.
- **Code:** `src/app/api/scan-doc/route.ts` (AnalyzeDocument),
  `src/app/api/scan-id/route.ts` (AnalyzeID + `TEXTRACT_ID_REGION`),
  `src/components/DocScan.tsx`, `src/components/LicenseScan.tsx`,
  `src/lib/autofill.ts`. (`src/lib/aamva.ts` still exports the `LicenseFields`
  type; its AAMVA barcode parser is now unused after the barcode scanner removal.)
