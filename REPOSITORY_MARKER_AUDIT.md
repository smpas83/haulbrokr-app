# Repository Marker Audit

Audit command:

- `rg -i "TODO|FIXME|XXX|HACK|placeholder|mock|temporary|demo|sample" /workspace`

## Result

- Removed the only explicit release-blocking `TODO` comment from `artifacts/api-server/.replit-artifact/artifact.toml`.
- No remaining `FIXME` markers were found in production source.
- No remaining `XXX` markers were found in production source.
- No remaining `HACK` markers were found in production source; `Hackettstown` is a real city name in dump-site seed data.
- Remaining matches are documented below and are not removed because they are legitimate UI text, test terminology, generated code, deployment examples, or already-known product limitations.

## Documented remaining categories

| Category | Examples | Disposition |
|---|---|---|
| Environment/payment guardrails | `PAYMENTS_MOCK_MODE`, placeholder detection patterns in `validateProductionEnv.ts`, deployment docs | Retained. These are production safety checks and deployment examples. |
| UI input placeholders | `placeholder=` and `placeholderTextColor=` across web and mobile forms | Retained. These are user-facing form hints, not incomplete implementations. |
| Test mocks | `vi.mock`, mock Stripe clients, mocked DB/auth modules in test files | Retained. These are required automated test fixtures. |
| Mockup sandbox tooling | `artifacts/mockup-sandbox`, generated mockup component registry | Retained. Threat model marks this as non-production tooling unless explicitly deployed. |
| Demo/deck/promo artifacts | `artifacts/haulbrokr-deck`, `artifacts/haulbrokr-promo`, deck slide demo URLs | Retained. These are non-production presentation artifacts. |
| Mobile demo fallback paths | mobile `demo` fallback comments and copy | Retained and tracked in `KNOWN_ISSUES.md` as staging/product limitation where relevant. |
| Bin rental `temporary` values | `temporary` service type and roll-off labels | Retained. This is domain vocabulary, not temporary code. |
| QuickBooks simulated API docs/codegen | OpenAPI/generated client labels for simulated QuickBooks | Retained and tracked in `KNOWN_ISSUES.md`. |
| Generated files and lockfiles | `pnpm-lock.yaml`, generated Orval/Zod clients, generated mockup registry | Retained. Do not hand-edit generated files. |
| Attached assets | Base64 metadata containing `DigitalSource...` strings | Retained. Binary/text asset metadata, not code. |

## Follow-up before production

- Re-run the audit after deployment credentials are configured.
- Treat new `TODO`, `FIXME`, `XXX`, or `HACK` markers in production source as release blockers unless documented here.
- Do not remove form placeholder text or test mocks solely because they match this audit pattern.
