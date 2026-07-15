# DOCUMENT_UPLOAD_TRACE.md

**Date:** 2026-07-15

## Happy path (after fixes)

```
AccountDocuments.handleFile / mobile handlePick
  → POST /api/storage/uploads/request-url   [requireProfile + Clerk]
       issues HMAC uploadToken; R2 PutObject signed WITH ContentType
  → PUT  <presigned R2 URL>                 [bytes]
  → POST /api/storage/uploads/finalize      [verify token, HEAD object, issue storageToken]
  → PUT  /api/driver-docs/:docType          [verify storageToken, upsert driver_documents status=uploaded]
       + syncFormPendingFromFileUpload(w9|coi) when matching form exists
  → Admin: GET /admin/documents?status=uploaded | GET /admin/compliance | GET /admin/profile/:id
  → View: GET /api/storage/objects/*        [staff session OR owner]
  → PATCH /admin/compliance/:id/documents/:docType  [approve → verified]
```

## File → function → line map

| Stage | File | Function / route | Lines (approx) |
|-------|------|------------------|----------------|
| Web UI | `artifacts/haulbrokr/src/components/documents.tsx` | `handleFile` | ~105–120 |
| Web upload helper | `artifacts/haulbrokr/src/lib/storageUpload.ts` | `uploadFileToStorage` | 23–62 |
| Mobile | `artifacts/haulbrokr-mobile/hooks/useLiveApi.ts` | `useUploadFile` | 680–702 |
| Presign | `artifacts/api-server/src/routes/storage.ts` | `POST …/request-url` | ~80–110 |
| R2 sign | `artifacts/api-server/src/lib/objectStorage.ts` | `getObjectEntityUploadURL(contentType?)` | ~159–175 |
| Finalize | `artifacts/api-server/src/routes/storage.ts` | `POST …/finalize` + `contentTypesCompatible` | ~53–63, ~120–190 |
| DB upsert | `artifacts/api-server/src/routes/driver-docs.ts` | `PUT /driver-docs/:docType` | ~35–140 |
| Form sync | `artifacts/api-server/src/lib/onboardingTrace.ts` | `syncFormPendingFromFileUpload` | — |
| Admin list | `artifacts/api-server/src/routes/admin.ts` | `GET /admin/documents` | — |
| Admin view ACL | `artifacts/api-server/src/middlewares/staffAuth.ts` | `requireProfileOrStaffCompliance` | — |
| Serve file | `artifacts/api-server/src/routes/storage.ts` | `GET /storage/objects/*` | — |
| Approve | `artifacts/api-server/src/lib/adminComplianceBundle.ts` | `reviewProviderUploadedDoc` | 246–264 |

## Failure modes found

### 1. Finalize MIME mismatch deleted uploads (CRITICAL)

- **Where:** `storage.ts` finalize content-type check  
- **Before:** Declared `image/jpeg` vs R2 actual `application/octet-stream` → 422 + **object deleted**  
- **User experience:** Toast “Upload failed”; no `driver_documents` row → Documents (0)  
- **Fix:** Sign PutObject with `ContentType`; treat `application/octet-stream` as compatible

### 2. Dual systems (HIGH)

- File uploads → `driver_documents`  
- Structured forms → `w9_submissions` / `insurance_submissions` / `dot_cdl_compliance`  
- Bidding gate uses **forms only**  
- Admin “Pending compliance” previously counted **forms only**  
- **Fix:** Overview `pendingCompliance` = forms pending + files uploaded; file upload syncs form to `pending` when form row exists

### 3. No unique constraint (MEDIUM)

- Concurrent `PUT /driver-docs/:type` could duplicate rows  
- **Fix:** unique index `driver_documents_profile_doc_type_uidx` on `(profile_id, doc_type)`

### 4. Orphan cleaner race (LOW)

- `orphanUploadCleaner` deletes `/uploads/*` older than 30 min with no DB reference  
- If finalize succeeds but `PUT /driver-docs` never runs, object is cleaned — correct behavior

## Is there a silent success path?

**Before:** User could PUT to R2 successfully, then finalize would delete the object — looked like “almost worked.”  
**After:** Finalize accepts octet-stream; ContentType is signed into the URL; failures still surface via toast.

## Test proof

- Unit: `storage.test.ts` — octet-stream accepted; staff View no longer 401  
- E2E script: `artifacts/api-server/scripts/e2e-onboarding-trace.ts` — PASS locally
