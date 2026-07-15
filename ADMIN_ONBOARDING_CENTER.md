# Admin Onboarding Center

Visible staff UI so ops do not need to call `GET /admin/onboarding-trace` manually.

## Where

- URL: `https://haulbrokr.com/admin`
- Tab: **Onboarding** (requires `overview` permission — same gate as the API)
- Component: `artifacts/haulbrokr/src/components/admin-onboarding.tsx`
- API: `GET /admin/onboarding-trace?filter=…` and `GET /admin/onboarding-trace/:profileId`

## Summary cards

| Card | Meaning |
|------|---------|
| New registrations | Funnel stage `new_registration` |
| Setup started | Profile or equipment started |
| Waiting for documents | Has progress but docs/forms incomplete |
| Waiting for approval | Uploaded / form pending review |
| Approved | Ready / verified path |
| Stalled &gt;24h | Incomplete and no activity for 24+ hours |

## Filters

`all` · `registered_only` · `incomplete` · `waiting_documents` · `pending_review` · `approved` · `stalled`

## Table columns

- Company / email  
- Stage  
- Last active date  
- Completion percentage  
- Missing items  
- Exact upload error (when a rejection note or doc note exists)

## Carrier detail timeline

Opening a row calls `GET /admin/onboarding-trace/:profileId`, which records `last_admin_onboarding_view_at` and returns:

1. Signup  
2. Email verified  
3. Company profile saved  
4. Equipment added  
5. Upload requested  
6. R2 upload completed  
7. Database finalized  
8. Admin viewed  
9. Approved  
10. Rejected  

All values come from Neon (profiles, trucks, upload_sessions, driver_documents, forms) — **no mock data**.

## Auth

- Staff password session **or** Clerk staff with `overview`
- Anonymous / normal carrier → **401 Unauthorized** on the API
- Document **View** still requires `compliance` for staff (storage ACL from PR #124)

## Schema (startup migration)

On API boot:

- `profiles.last_admin_onboarding_view_at`
- unique index `driver_documents_profile_doc_type_uidx` on `(profile_id, doc_type)`
