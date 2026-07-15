# Live Carrier Onboarding Report

**Generated:** 2026-07-15  
**Environment:** Production (`haulbrokr.com` + `haulbrokr-api.onrender.com`)  
**Agent result:** **PRODUCTION BLOCKED** (no Neon/R2/staff secrets in Cursor)

## Endpoint probe

| Check | Result |
|-------|--------|
| `GET https://haulbrokr.com/api/readyz` | 200 `{"status":"ok"}` |
| `GET https://haulbrokr-api.onrender.com/api/readyz` | 200 `{"status":"ok"}` |
| `GET /api/admin/onboarding-trace` (no auth) | **401** `{"error":"Unauthorized"}` |
| `GET /api/admin/onboarding-trace` (Bearer fake) | **401** |
| Staff-authenticated trace dump | **Not available** in this environment |

Staff protection: **PASS** (normal / anonymous sessions cannot open the endpoint).

## Carrier table (from `GET /admin/onboarding-trace`)

> Populate by running `scripts/verify-live-carrier-onboarding.sh` with staff credentials.

| company | account created | last activity | profile completed | equipment added | W-9 status | COI status | insurance status | storage object exists | database record exists | admin can view | overall % | current blocker | recommended follow-up |
|---------|-----------------|---------------|-------------------|-----------------|------------|------------|------------------|----------------------|------------------------|----------------|--------|-----------------|----------------------|
| *awaiting operator run* | — | — | — | — | — | — | — | — | — | — | — | Staff login + script | Run verify script after test carrier A–J |

## Workflow A–J checklist (operator)

- [ ] **A.** Create new test carrier via public signup
- [ ] **B.** Verify email and sign in
- [ ] **C.** Complete company/profile
- [ ] **D.** Add one truck/equipment
- [ ] **E.** Upload W-9 PDF, COI PDF, one image (if supported)
- [ ] **F.** Confirm each file in R2 (correct Content-Type), Neon `driver_documents`, form status → pending
- [ ] **G.** Staff login → Admin dashboard
- [ ] **H.** Pending Review ↑, All Documents lists files, carrier not Documents (0), View opens without Unauthorized, onboarding progress accurate
- [ ] **I.** Approve uploaded documents
- [ ] **J.** Pending ↓, verified ↑, carrier onboarding progress updates, carrier sees approved

## Safe operator command

```bash
export STAFF_USERNAME='…'
export STAFF_PASSWORD='…'
# optional for deeper R2/SQL checks:
# export DATABASE_URL='…'
# export R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET PRIVATE_OBJECT_DIR
./scripts/verify-live-carrier-onboarding.sh
```

Do not paste secret values into Cursor, GitHub, or chat.

## Blocker

**Single manual action remaining:** operator completes A–J in production with real Clerk/Neon/R2, then re-runs the verify script and pastes only the **redacted** carrier table (no secrets) into this report to upgrade to PRODUCTION PASS.
