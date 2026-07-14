import type {
  FmcsaFieldStatus,
  FmcsaLookupResult,
  FmcsaProvider,
  FmcsaProviderHealth,
} from "./types";
import { logger } from "../logger";

const DEFAULT_BASE = "https://mobile.fmcsa.dot.gov/qc/services";
const TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;
const CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry = { expiresAt: number; result: FmcsaLookupResult };

const cache = new Map<string, CacheEntry>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function mapStatus(value: unknown): FmcsaFieldStatus {
  if (value == null || value === "") return "incomplete";
  const s = String(value).toLowerCase();
  if (["active", "authorized", "satisfactory", "yes", "true", "a"].includes(s))
    return "verified";
  if (
    [
      "inactive",
      "unauthorized",
      "unsatisfactory",
      "out-of-service",
      "no",
      "false",
      "suspended",
    ].includes(s)
  ) {
    return "failed";
  }
  return "incomplete";
}

/**
 * Live FMCSA QCMobile carrier lookup.
 * Requires FMCSA_WEB_KEY. Never auto-verifies on partial responses.
 */
export class LiveQcMobileFmcsaProvider implements FmcsaProvider {
  readonly name = "qc_mobile_live";

  constructor(
    private readonly webKey = process.env.FMCSA_WEB_KEY?.trim() ?? "",
    private readonly baseUrl = (
      process.env.FMCSA_API_BASE_URL?.trim() || DEFAULT_BASE
    ).replace(/\/$/, ""),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  hasCredentials(): boolean {
    return this.webKey.length > 0;
  }

  async health(): Promise<FmcsaProviderHealth> {
    if (!this.hasCredentials()) return "missing_credentials";
    try {
      // Lightweight probe — invalid DOT should still return a structured HTTP response.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const url = `${this.baseUrl}/carriers/0?webKey=${encodeURIComponent(this.webKey)}`;
      const res = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timer);
      if (res.status === 401 || res.status === 403)
        return "missing_credentials";
      if (res.status >= 500) return "configured_unavailable";
      return "configured_healthy";
    } catch {
      return "configured_unavailable";
    }
  }

  async lookupByDot(dotNumber: string): Promise<FmcsaLookupResult> {
    const cleaned = String(dotNumber ?? "").replace(/\D/g, "");
    const lookedUpAt = new Date().toISOString();

    if (!cleaned) {
      return {
        code: "invalid_input",
        source: "live",
        lookedUpAt,
        health: this.hasCredentials()
          ? "configured_healthy"
          : "missing_credentials",
        autoVerifyEligible: false,
        fields: {
          fmcsaAuthority: "unknown",
          insuranceActive: "unknown",
          dotOperatingStatus: "unknown",
          notSuspended: "unknown",
          safetyRating: null,
        },
        rawFields: {},
        errorMessage: "DOT number is required",
      };
    }

    if (!this.hasCredentials()) {
      return {
        code: "missing_credentials",
        source: "live",
        lookedUpAt,
        health: "missing_credentials",
        autoVerifyEligible: false,
        fields: {
          fmcsaAuthority: "unknown",
          insuranceActive: "unknown",
          dotOperatingStatus: "unknown",
          notSuspended: "unknown",
          safetyRating: null,
        },
        rawFields: {},
        errorMessage: "FMCSA_WEB_KEY is not configured",
      };
    }

    const cached = cache.get(cleaned);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.result, source: "cache", lookedUpAt };
    }

    let lastError: string | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const url = `${this.baseUrl}/carriers/${encodeURIComponent(cleaned)}?webKey=${encodeURIComponent(this.webKey)}`;
        const res = await this.fetchImpl(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timer);

        if (res.status === 404) {
          const notFound: FmcsaLookupResult = {
            code: "carrier_not_found",
            source: "live",
            lookedUpAt,
            health: "configured_healthy",
            autoVerifyEligible: false,
            carrier: { dotNumber: cleaned },
            fields: {
              fmcsaAuthority: "failed",
              insuranceActive: "unknown",
              dotOperatingStatus: "failed",
              notSuspended: "unknown",
              safetyRating: null,
            },
            rawFields: { httpStatus: 404 },
            errorMessage: "Carrier not found in FMCSA QCMobile",
          };
          cache.set(cleaned, {
            expiresAt: Date.now() + CACHE_TTL_MS,
            result: notFound,
          });
          return notFound;
        }

        if (res.status === 401 || res.status === 403) {
          return {
            code: "missing_credentials",
            source: "live",
            lookedUpAt,
            health: "missing_credentials",
            autoVerifyEligible: false,
            fields: {
              fmcsaAuthority: "unknown",
              insuranceActive: "unknown",
              dotOperatingStatus: "unknown",
              notSuspended: "unknown",
              safetyRating: null,
            },
            rawFields: { httpStatus: res.status },
            errorMessage: "FMCSA rejected the web key",
          };
        }

        if (!res.ok) {
          lastError = `HTTP ${res.status}`;
          if (res.status >= 500 && attempt < MAX_RETRIES) {
            await sleep(200 * (attempt + 1));
            continue;
          }
          return {
            code: "provider_unavailable",
            source: "live",
            lookedUpAt,
            health: "configured_unavailable",
            autoVerifyEligible: false,
            fields: {
              fmcsaAuthority: "unknown",
              insuranceActive: "unknown",
              dotOperatingStatus: "unknown",
              notSuspended: "unknown",
              safetyRating: null,
            },
            rawFields: { httpStatus: res.status },
            errorMessage: lastError,
          };
        }

        const body = (await res.json()) as Record<string, unknown>;
        const content = (body.content ?? body.carrier ?? body) as Record<
          string,
          unknown
        >;
        const carrier = (content.carrier ?? content) as Record<string, unknown>;

        const operatingStatus = String(
          carrier.operatingStatus ?? carrier.statusCode ?? "",
        );
        const authorityStatus = String(
          carrier.commonAuthorityStatus ??
            carrier.authorityStatus ??
            carrier.allowedToOperate ??
            "",
        );
        const insuranceStatus = String(
          carrier.bipdInsuranceOnFile ??
            carrier.insuranceStatus ??
            carrier.liabilityInsurance ??
            "",
        );
        const safetyRating =
          carrier.safetyRating != null ? String(carrier.safetyRating) : null;
        const oos =
          carrier.oosDate != null ||
          String(carrier.outOfService ?? "").toLowerCase() === "true" ||
          String(operatingStatus).toLowerCase().includes("out of service");

        const fields = {
          fmcsaAuthority: mapStatus(authorityStatus || null),
          insuranceActive: mapStatus(insuranceStatus || null),
          dotOperatingStatus: mapStatus(operatingStatus || null),
          notSuspended: oos
            ? ("failed" as const)
            : operatingStatus
              ? ("verified" as const)
              : ("incomplete" as const),
          safetyRating,
        };

        const incomplete =
          fields.fmcsaAuthority === "incomplete" ||
          fields.insuranceActive === "incomplete" ||
          fields.dotOperatingStatus === "incomplete" ||
          fields.notSuspended === "incomplete" ||
          !authorityStatus ||
          !operatingStatus;

        // Never auto-verify on a partial response.
        const autoVerifyEligible =
          !incomplete &&
          fields.fmcsaAuthority === "verified" &&
          fields.insuranceActive === "verified" &&
          fields.dotOperatingStatus === "verified" &&
          fields.notSuspended === "verified";

        const result: FmcsaLookupResult = {
          code: incomplete ? "provider_incomplete" : "ok",
          source: "live",
          lookedUpAt,
          health: "configured_healthy",
          autoVerifyEligible,
          carrier: {
            legalName:
              carrier.legalName != null ? String(carrier.legalName) : undefined,
            dbaName:
              carrier.dbaName != null ? String(carrier.dbaName) : undefined,
            dotNumber: cleaned,
            mcNumber:
              carrier.mcNumber != null ? String(carrier.mcNumber) : undefined,
            operatingStatus: operatingStatus || undefined,
            authorityStatus: authorityStatus || undefined,
            insuranceStatus: insuranceStatus || undefined,
            safetyRating: safetyRating ?? undefined,
            outOfService: Boolean(oos),
          },
          fields,
          rawFields: {
            legalName: carrier.legalName ?? null,
            dbaName: carrier.dbaName ?? null,
            operatingStatus: operatingStatus || null,
            authorityStatus: authorityStatus || null,
            insuranceStatus: insuranceStatus || null,
            safetyRating: safetyRating,
            outOfService: Boolean(oos),
          },
          errorMessage: incomplete
            ? "Provider response incomplete — manual review required"
            : undefined,
        };

        cache.set(cleaned, { expiresAt: Date.now() + CACHE_TTL_MS, result });
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "lookup_failed";
        logger.warn(
          { attempt, err: lastError },
          "FMCSA live lookup attempt failed",
        );
        if (attempt < MAX_RETRIES) await sleep(200 * (attempt + 1));
      }
    }

    return {
      code: "provider_unavailable",
      source: "live",
      lookedUpAt,
      health: "configured_unavailable",
      autoVerifyEligible: false,
      fields: {
        fmcsaAuthority: "unknown",
        insuranceActive: "unknown",
        dotOperatingStatus: "unknown",
        notSuspended: "unknown",
        safetyRating: null,
      },
      rawFields: {},
      errorMessage: lastError ?? "FMCSA provider unavailable",
    };
  }
}

/** Test helper */
export function clearFmcsaCache(): void {
  cache.clear();
}
