import { logger } from "./logger";

const FMCSA_BASE = "https://mobile.fmcsa.dot.gov/qc/services";

export type FmcsaCarrier = {
  dotNumber: string;
  mcNumber: string | null;
  legalName: string | null;
  dbaName: string | null;
  allowedToOperate: boolean | null;
  outOfService: boolean | null;
  safetyRating: string | null;
  phyStreet: string | null;
  phyCity: string | null;
  phyState: string | null;
  phyZip: string | null;
  telephone: string | null;
  bipdInsuranceOnFile: string | null;
  bipdInsuranceRequired: string | null;
  cargoInsuranceOnFile: string | null;
  commonAuthorityStatus: string | null;
  contractAuthorityStatus: string | null;
  brokerAuthorityStatus: string | null;
  raw: unknown;
};

export type FmcsaLookupResult =
  | { ok: true; carrier: FmcsaCarrier }
  | { ok: false; code: string; message: string; retryable: boolean };

export type FmcsaAuthorityResult =
  | {
      ok: true;
      commonAuthority: string | null;
      contractAuthority: string | null;
      brokerAuthority: string | null;
      raw: unknown;
    }
  | { ok: false; code: string; message: string; retryable: boolean };

function webKey(): string | null {
  return process.env.FMCSA_WEB_KEY?.trim() || null;
}

export function isFmcsaConfigured(): boolean {
  return webKey() != null;
}

function yn(value: unknown): boolean | null {
  if (value == null) return null;
  const s = String(value).trim().toUpperCase();
  if (s === "Y" || s === "YES" || s === "TRUE" || s === "1") return true;
  if (s === "N" || s === "NO" || s === "FALSE" || s === "0") return false;
  return null;
}

function pickCarrierObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  // QCMobile wraps content in { content: { carrier: {...} } } or { content: [...] }
  const content = root.content ?? root;
  if (Array.isArray(content)) {
    const first = content[0];
    if (first && typeof first === "object") {
      const c = (first as Record<string, unknown>).carrier ?? first;
      return c && typeof c === "object" ? (c as Record<string, unknown>) : null;
    }
    return null;
  }
  if (content && typeof content === "object") {
    const c = (content as Record<string, unknown>).carrier ?? content;
    return c && typeof c === "object" ? (c as Record<string, unknown>) : null;
  }
  return null;
}

function mapCarrier(
  raw: Record<string, unknown>,
  fallbackDot?: string,
): FmcsaCarrier {
  const dot = String(
    raw.dotNumber ?? raw.dot_number ?? fallbackDot ?? "",
  ).trim();
  const mcRaw = raw.mcNumber ?? raw.mc_number ?? raw.docketNumber ?? null;
  return {
    dotNumber: dot,
    mcNumber:
      mcRaw != null && String(mcRaw).trim() ? String(mcRaw).trim() : null,
    legalName: raw.legalName != null ? String(raw.legalName) : null,
    dbaName: raw.dbaName != null ? String(raw.dbaName) : null,
    allowedToOperate: yn(raw.allowToOperate ?? raw.allowedToOperate),
    outOfService: yn(raw.outOfService),
    safetyRating:
      raw.safetyRating != null
        ? String(raw.safetyRating)
        : raw.safety_rating != null
          ? String(raw.safety_rating)
          : null,
    phyStreet: raw.phyStreet != null ? String(raw.phyStreet) : null,
    phyCity: raw.phyCity != null ? String(raw.phyCity) : null,
    phyState: raw.phyState != null ? String(raw.phyState) : null,
    phyZip: raw.phyZip != null ? String(raw.phyZip) : null,
    telephone: raw.telephone != null ? String(raw.telephone) : null,
    bipdInsuranceOnFile:
      raw.bipdInsuranceOnFile != null ? String(raw.bipdInsuranceOnFile) : null,
    bipdInsuranceRequired:
      raw.bipdInsuranceRequired != null
        ? String(raw.bipdInsuranceRequired)
        : null,
    cargoInsuranceOnFile:
      raw.cargoInsuranceOnFile != null
        ? String(raw.cargoInsuranceOnFile)
        : null,
    commonAuthorityStatus:
      raw.commonAuthorityStatus != null
        ? String(raw.commonAuthorityStatus)
        : null,
    contractAuthorityStatus:
      raw.contractAuthorityStatus != null
        ? String(raw.contractAuthorityStatus)
        : null,
    brokerAuthorityStatus:
      raw.brokerAuthorityStatus != null
        ? String(raw.brokerAuthorityStatus)
        : null,
    raw,
  };
}

type FmcsaFetchFailure = {
  ok: false;
  code: string;
  message: string;
  retryable: boolean;
};
type FmcsaFetchOk = { ok: true; json: unknown };
type FmcsaFetchResult = FmcsaFetchFailure | FmcsaFetchOk;

async function fmcsaFetch(
  path: string,
  attempt = 1,
): Promise<FmcsaFetchResult> {
  const key = webKey();
  if (!key) {
    return {
      ok: false,
      code: "fmcsa_not_configured",
      message:
        "FMCSA_WEB_KEY is not configured. Obtain a web key from https://mobile.fmcsa.dot.gov/QCDevsite/",
      retryable: false,
    };
  }

  const url = `${FMCSA_BASE}${path}${path.includes("?") ? "&" : "?"}webKey=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 429 || res.status >= 500) {
      if (attempt < 3) {
        const delay = attempt * 500;
        await new Promise((r) => setTimeout(r, delay));
        return fmcsaFetch(path, attempt + 1);
      }
      return {
        ok: false,
        code: `fmcsa_http_${res.status}`,
        message: `FMCSA API returned ${res.status} after retries.`,
        retryable: true,
      };
    }

    if (res.status === 404) {
      return {
        ok: false,
        code: "carrier_not_found",
        message: "No carrier found for that number.",
        retryable: false,
      };
    }

    if (!res.ok) {
      const text = await res.text();
      logger.warn(
        { status: res.status, text: text.slice(0, 500), path },
        "FMCSA API error",
      );
      return {
        ok: false,
        code: `fmcsa_http_${res.status}`,
        message: text.slice(0, 200) || `FMCSA API returned ${res.status}`,
        retryable: res.status === 401 || res.status === 403 ? false : true,
      };
    }

    const json = await res.json();
    return { ok: true, json };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 500));
      return fmcsaFetch(path, attempt + 1);
    }
    logger.error({ err, path }, "FMCSA network error");
    return { ok: false, code: "fmcsa_network_error", message, retryable: true };
  }
}

export async function lookupCarrierByDot(
  dotNumber: string,
): Promise<FmcsaLookupResult> {
  const cleaned = String(dotNumber).replace(/\D/g, "");
  if (!cleaned) {
    return {
      ok: false,
      code: "invalid_dot",
      message: "DOT number is required.",
      retryable: false,
    };
  }

  const fetched = await fmcsaFetch(`/carriers/${cleaned}`);
  if (!fetched.ok) return fetched;

  const carrierObj = pickCarrierObject(fetched.json);
  if (!carrierObj) {
    return {
      ok: false,
      code: "carrier_not_found",
      message: "No carrier found for that DOT number.",
      retryable: false,
    };
  }
  return { ok: true, carrier: mapCarrier(carrierObj, cleaned) };
}

export async function lookupCarrierByMc(
  mcNumber: string,
): Promise<FmcsaLookupResult> {
  const cleaned = String(mcNumber).replace(/\D/g, "");
  if (!cleaned) {
    return {
      ok: false,
      code: "invalid_mc",
      message: "MC / docket number is required.",
      retryable: false,
    };
  }

  const fetched = await fmcsaFetch(`/carriers/docket-number/${cleaned}`);
  if (!fetched.ok) return fetched;

  const carrierObj = pickCarrierObject(fetched.json);
  if (!carrierObj) {
    // Some responses return a list under content
    const root = fetched.json as Record<string, unknown>;
    const content = root.content;
    if (Array.isArray(content) && content.length > 0) {
      const first = content[0] as Record<string, unknown>;
      const c = (first.carrier ?? first) as Record<string, unknown>;
      return { ok: true, carrier: mapCarrier(c) };
    }
    return {
      ok: false,
      code: "carrier_not_found",
      message: "No carrier found for that MC number.",
      retryable: false,
    };
  }
  return { ok: true, carrier: mapCarrier(carrierObj) };
}

export async function lookupCarrierAuthority(
  dotNumber: string,
): Promise<FmcsaAuthorityResult> {
  const cleaned = String(dotNumber).replace(/\D/g, "");
  if (!cleaned) {
    return {
      ok: false,
      code: "invalid_dot",
      message: "DOT number is required.",
      retryable: false,
    };
  }

  const fetched = await fmcsaFetch(`/carriers/${cleaned}/authority`);
  if (!fetched.ok) return fetched;

  const root = fetched.json as Record<string, unknown>;
  const content = (root.content ?? root) as Record<string, unknown> | unknown[];
  const auth = Array.isArray(content)
    ? (content[0] as Record<string, unknown> | undefined)
    : (content as Record<string, unknown>);

  return {
    ok: true,
    commonAuthority:
      auth?.commonAuthorityStatus != null
        ? String(auth.commonAuthorityStatus)
        : auth?.authorityStatus != null
          ? String(auth.authorityStatus)
          : null,
    contractAuthority:
      auth?.contractAuthorityStatus != null
        ? String(auth.contractAuthorityStatus)
        : null,
    brokerAuthority:
      auth?.brokerAuthorityStatus != null
        ? String(auth.brokerAuthorityStatus)
        : null,
    raw: fetched.json,
  };
}

export type FmcsaComplianceSnapshot = {
  fmcsaAuthority: "verified" | "failed" | "unknown";
  insuranceActive: "verified" | "failed" | "unknown";
  dotOperatingStatus: "verified" | "failed" | "unknown";
  notSuspended: "verified" | "failed" | "unknown";
  safetyRating: string | null;
  fmcsaLegalName: string | null;
  fmcsaDbaName: string | null;
  fmcsaAllowedToOperate: string | null;
  fmcsaOutOfService: string | null;
  status: "verified" | "failed" | "pending";
  reviewNote: string | null;
};

export function deriveComplianceFromFmcsa(
  carrier: FmcsaCarrier,
  authority?: {
    commonAuthority: string | null;
    contractAuthority: string | null;
  } | null,
): FmcsaComplianceSnapshot {
  const oos = carrier.outOfService === true;
  const allowed = carrier.allowedToOperate === true;
  const authActive =
    authority?.commonAuthority?.toUpperCase() === "ACTIVE" ||
    authority?.contractAuthority?.toUpperCase() === "ACTIVE" ||
    carrier.commonAuthorityStatus?.toUpperCase() === "ACTIVE" ||
    carrier.contractAuthorityStatus?.toUpperCase() === "ACTIVE";

  const bipdOk =
    carrier.bipdInsuranceOnFile != null &&
    String(carrier.bipdInsuranceOnFile).trim() !== "" &&
    String(carrier.bipdInsuranceOnFile) !== "0";

  const operating: "verified" | "failed" | "unknown" =
    carrier.allowedToOperate == null
      ? "unknown"
      : allowed && !oos
        ? "verified"
        : "failed";
  const suspended: "verified" | "failed" | "unknown" =
    carrier.outOfService == null ? "unknown" : oos ? "failed" : "verified";
  const authorityStatus: "verified" | "failed" | "unknown" = authActive
    ? "verified"
    : authority ||
        carrier.commonAuthorityStatus ||
        carrier.contractAuthorityStatus
      ? "failed"
      : "unknown";
  const insurance: "verified" | "failed" | "unknown" =
    carrier.bipdInsuranceOnFile == null && carrier.bipdInsuranceRequired == null
      ? "unknown"
      : bipdOk
        ? "verified"
        : "failed";

  const allGood =
    operating === "verified" &&
    suspended === "verified" &&
    (authorityStatus === "verified" || authorityStatus === "unknown") &&
    (insurance === "verified" || insurance === "unknown");

  const anyFailed = [operating, suspended, authorityStatus, insurance].includes(
    "failed",
  );

  return {
    fmcsaAuthority: authorityStatus,
    insuranceActive: insurance,
    dotOperatingStatus: operating,
    notSuspended: suspended,
    safetyRating: carrier.safetyRating,
    fmcsaLegalName: carrier.legalName,
    fmcsaDbaName: carrier.dbaName,
    fmcsaAllowedToOperate:
      carrier.allowedToOperate == null ? null : allowed ? "Y" : "N",
    fmcsaOutOfService: carrier.outOfService == null ? null : oos ? "Y" : "N",
    status: anyFailed ? "failed" : allGood ? "verified" : "pending",
    reviewNote: anyFailed
      ? "Live FMCSA check found one or more failed compliance signals."
      : allGood
        ? "Verified via FMCSA QCMobile API."
        : "Partial FMCSA data — awaiting full authority/insurance signals.",
  };
}
