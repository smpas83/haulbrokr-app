/** Production API host (no protocol). Required for native/store builds. */
export function getExpoPublicDomain(): string | undefined {
  const raw = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  return raw || undefined;
}

export function isExpoPublicDomainValid(domain: string | undefined): boolean {
  if (!domain) return false;
  if (domain.includes("localhost") || domain.startsWith("127.0.0.1")) return false;
  return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(domain);
}

/** `https://<domain>/api` — throws when the domain is missing or invalid. */
export function getApiBaseUrl(): string {
  const domain = getExpoPublicDomain();
  if (!isExpoPublicDomainValid(domain)) {
    throw new Error(
      "EXPO_PUBLIC_DOMAIN must be set to your production host (e.g. haulbrokr.com) before calling the API.",
    );
  }
  return `https://${domain}/api`;
}

/** Same as getApiBaseUrl but returns null instead of throwing (for optional hooks). */
export function getApiBaseUrlOrNull(): string | null {
  const domain = getExpoPublicDomain();
  return isExpoPublicDomainValid(domain) ? `https://${domain}/api` : null;
}
