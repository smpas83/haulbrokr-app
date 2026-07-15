# ADMIN_DASHBOARD_AUDIT.md

**Date:** 2026-07-15

## Data sources

| UI surface | API | Tables |
|------------|-----|--------|
| Overview KPIs | `GET /admin/overview` | jobs, profiles, forms, `driver_documents`, bins, credit |
| People drill-down | `GET /admin/people` | `profiles` |
| Profile detail Documents (N) | `GET /admin/profile/:id` | `driver_documents` (+ forms via new `onboarding`) |
| Documents Pending/Verified | `GET /admin/documents?status=` | `driver_documents` ⋈ `profiles` |
| Compliance tab | `GET /admin/compliance` | forms + filtered uploads (`listProviderComplianceBundles`) |
| Onboarding trace (**new**) | `GET /admin/onboarding-trace` | full carrier step status |

## Bugs fixed

### Pending stayed at 0

- **UI:** Compliance badge / overview used `pendingCompliance`  
- **Old query:** count of form rows with `status='pending'` only  
- **If carriers only uploaded files:** forms stayed `not_submitted` → Pending = 0 even with files in `driver_documents`  
- **Fix:** `countPendingComplianceWork()` → `pendingCompliance = formPending + documentsPending`  
- Also: `documentsVerified` now returned and shown as a number (was “View” only)

### Documents (0) on carrier profile

- Profile detail correctly reads `driver_documents`  
- Count 0 means **no file rows** — forms alone do not appear in that list  
- After upload succeeds, count > 0; new `onboarding` block shows form+file status

### Verified only showed a few

- Drill filter `status=verified` is correct  
- Low count reflected few successful uploads/approvals, not a wrong table  
- Verified metric now shows the real count from DB

### Unauthorized on View

- See AUTH_AUDIT.md — staff cookie not accepted on storage route  
- Fixed in storage ACL + credentialed blob open in UI

## Filters that still apply (by design)

1. Compliance tab: providers only; `ADMIN_UPLOAD_DOC_TYPES`; skips `missing`; drops empty bundles  
2. Job carrier docs: only `coi`, `w9`, `dot_authority`  
3. Approve buttons: only when `status === "uploaded"`

## How to inspect every carrier after deploy

```
GET /api/admin/onboarding-trace
GET /api/admin/onboarding-trace/:profileId
GET /api/admin/documents?status=uploaded
GET /api/admin/documents?status=verified
GET /api/admin/profile/:id
```

Each carrier trace includes: Profile Complete, Truck Added, W9/COI uploads, forms, DOT, payout, storage/DB flags, Overall Status, Reason Blocked.
