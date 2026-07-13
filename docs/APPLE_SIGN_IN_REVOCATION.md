# Sign in with Apple + Account Deletion (P0 App Store Gate)

**Decision:** HaulBrokr’s backend owns Apple authorization-code exchange, encrypted refresh-token storage, and `/auth/revoke` during account deletion. Clerk continues to authenticate users, but **Clerk user deletion does not revoke Apple tokens** — we must do that ourselves.

Until this gate is verified on a physical device via TestFlight, HaulBrokr is **internal testing only** — do not submit a public App Store release.

## Operator answers (fill before production deploy)

| Question | Answer |
|---|---|
| Who owns Apple token exchange / revocation? | **HaulBrokr backend** (not Clerk) |
| Are Apple credentials available as environment secrets? | _Operator: confirm after storing in Render_ |
| Physical iPhone available for TestFlight? | _Operator: yes/no_ |

## Apple Developer checklist

In Apple Developer (Certificates, Identifiers & Profiles):

1. Confirm **Sign in with Apple** capability on the App ID / Bundle ID used by HaulBrokr (typically `com.haulbrokr.mobile`).
2. Note **Team ID** (Membership).
3. Create or confirm a **Sign in with Apple** key → note **Key ID** and download the **.p8** private key once.
4. Confirm the **Bundle ID** (native) or **Services ID** that matches `APPLE_CLIENT_ID`.

Store in Render (or your production secret manager) — **never commit the .p8 or paste it into chat/PRs**:

| Secret | Example / notes |
|---|---|
| `APPLE_TEAM_ID` | 10-character Team ID |
| `APPLE_KEY_ID` | Key ID from the Apple key |
| `APPLE_CLIENT_ID` | `com.haulbrokr.mobile` |
| `APPLE_PRIVATE_KEY` | PKCS#8 PEM contents (escaped `\n` OK) |
| `APPLE_TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` |

Production API boot **requires** these variables (`validateProductionEnv`).

## What the code does

1. **Native Apple sign-in** (`artifacts/haulbrokr-mobile`) captures `authorizationCode` + `identityToken`.
2. Identity token → Clerk session (`oauth_token_apple`).
3. Authorization code → `POST /api/account/apple-authorization` → Apple `/auth/token` → encrypted refresh token in `apple_auth_tokens`.
4. **Delete account** (`DELETE /api/profiles/me`) runs an outbox state machine:
   - revoke Apple refresh token (`/auth/revoke`)
   - anonymize profile / PII
   - delete Clerk user
5. Background **account deletion scheduler** retries failed Apple revokes.

## TestFlight smoke checklist (physical iPhone)

- [ ] Sign in with Apple (new + returning user)
- [ ] Sign in with Google / email
- [ ] Account deletion (Settings → Delete Account) — confirm Apple ID “Stop using Apple ID” / re-auth prompt behavior
- [ ] Camera / photo capture on a job
- [ ] Location permission + live tracking
- [ ] Push notification receipt
- [ ] Payments / Stripe Connect path used in beta
- [ ] Deep links (`haulbrokr://…` and associated domains)

## Release posture

| Gate | Status |
|---|---|
| Code: Apple exchange + encrypted storage + deletion/revoke state machine | Implemented in this branch |
| Secrets in production secret manager | **Operator required** |
| Physical TestFlight verification | **Operator required** |
| Public App Store submission | **NO-GO** until gates above are evidenced |
