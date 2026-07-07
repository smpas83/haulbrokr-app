# Platform Separation — Phase 2 Report

**Date:** 2026-07-07  
**Branch:** `cursor/kash-platform-phase2-b754`

## Summary

Phase 2 introduces the KASH platform adapter layer and moves HaulBrokr-specific intelligence/voice logic into app-owned modules under `apps/haulbrokr/`. Core platform code now routes through `ApplicationAdapter` instead of hardcoded HaulBrokr references.

## Architecture Added

| Layer               | Path                                                                                  | Purpose                                                                          |
| ------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Platform core       | `lib/platform/`                                                                       | `ApplicationAdapter`, `IntelligenceRouter`, `voice-commands`, workspace registry |
| HaulBrokr app       | `apps/haulbrokr/`                                                                     | `HaulBrokrAdapter`, copilot logic, voice commands, branding metadata             |
| Compatibility shims | `src/features/haulbrokr/`, `src/components/haulbrokr/`, `src/intelligence/haulbrokr/` | Re-export app modules for legacy imports                                         |

## Refactors Completed

### 1. IntelligenceRouter (`lib/platform/src/IntelligenceRouter.ts`)

- Removed HaulBrokr-specific copilot logic from `artifacts/api-server/src/routes/copilot.ts`.
- Copilot route now bootstraps `HaulBrokrAdapter` and delegates to `IntelligenceRouter`.
- HaulBrokr query/suggestion logic lives in `apps/haulbrokr/src/intelligence/copilotLogic.ts`.

### 2. Voice commands (`lib/platform/src/voice-commands.ts`)

- Added adapter-based `VoiceCommandRegistry` with register/match/execute APIs.
- HaulBrokr commands registered in `apps/haulbrokr/src/intelligence/voiceCommands.ts`.
- Future apps can register commands via `ApplicationAdapter.registerVoiceCommands()` without editing platform files.

### 3. Physical module migration

| Former (planned)              | New location                       | Shim                                  |
| ----------------------------- | ---------------------------------- | ------------------------------------- |
| `src/features/haulbrokr/`     | `apps/haulbrokr/src/features/`     | `src/features/haulbrokr/index.ts`     |
| `src/components/haulbrokr/`   | `apps/haulbrokr/src/components/`   | `src/components/haulbrokr/index.ts`   |
| `src/intelligence/haulbrokr/` | `apps/haulbrokr/src/intelligence/` | `src/intelligence/haulbrokr/index.ts` |

### 4. Backward compatibility preserved

- `/copilot/*` API routes unchanged (still mounted at same paths).
- `/haulbrokr/*` web routes and `/api/haulbrokr/*` API prefix constants retained in app module.
- Existing copilot tests pass against refactored router.
- No business logic removed — logic relocated behind adapter boundary.

## Workspace Packages

- `@workspace/platform` — platform adapter contracts and routers
- `@workspace/haulbrokr-app` — HaulBrokr application adapter and modules

## Tests Added

- `lib/platform/src/platform.test.ts` — IntelligenceRouter + voice registry
- `apps/haulbrokr/src/haulbrokr.test.ts` — HaulBrokr adapter + voice commands

## Remaining Phase 3+ Work

- Move web UI components (e.g. `copilot-panel.tsx`) physically into `apps/haulbrokr/components/` with re-export from web artifact.
- Replace hand-written mobile `useLiveApi.ts` with generated client + adapter hooks.
- Parameterize API-server CORS/branding via workspace config instead of inline `haulbrokr.com` strings.
- Multi-app workspace selector for non-HaulBrokr future apps.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
