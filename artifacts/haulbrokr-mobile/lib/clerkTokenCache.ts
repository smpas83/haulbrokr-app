import AsyncStorage from "@react-native-async-storage/async-storage";
import { getClerkInstance } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";
import { DevSettings, Platform } from "react-native";

/** Clerk Expo stores the headless client JWT under this SecureStore key. */
export const CLERK_CLIENT_JWT_KEY = "__clerk_client_jwt";

const PENDING_SIGN_OUT_KEY = "haulbrokr:pending_sign_out";
const CLERK_LOAD_TIMEOUT_MS = 8_000;

const secureStoreOpts: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/** Older builds wrote JWTs without keychain options — try every variant. */
const secureStoreDeleteOpts: SecureStore.SecureStoreOptions[] = [
  {},
  secureStoreOpts,
  { keychainAccessible: SecureStore.WHEN_UNLOCKED },
  { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
];

async function deleteSecureStoreKey(key: string) {
  await Promise.all(
    secureStoreDeleteOpts.map((opts) =>
      SecureStore.deleteItemAsync(key, opts).catch(() => {})
    )
  );
}

export const clerkTokenCache = {
  async getToken(key: string) {
    for (const opts of [{}, secureStoreOpts]) {
      try {
        const item = await SecureStore.getItemAsync(key, opts as SecureStore.SecureStoreOptions);
        if (item) return item;
      } catch {
        await deleteSecureStoreKey(key);
      }
    }
    return null;
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value, secureStoreOpts);
    } catch {}
  },
  clearToken(key: string) {
    void deleteSecureStoreKey(key);
  },
};

/** Remove persisted Clerk client JWT so the next load starts signed-out. */
export async function clearClerkSessionTokens() {
  await deleteSecureStoreKey(CLERK_CLIENT_JWT_KEY);
}

/** Set before sign-out so the next JS boot clears JWT before ClerkProvider mounts. */
export async function markPendingSignOut() {
  await AsyncStorage.setItem(PENDING_SIGN_OUT_KEY, "1");
}

/** Run once before ClerkProvider — clears stale JWT left over from sign-out. */
export async function prepareAuthStorage() {
  const pending = await AsyncStorage.getItem(PENDING_SIGN_OUT_KEY);
  if (pending === "1") {
    await clearClerkSessionTokens();
    await AsyncStorage.removeItem(PENDING_SIGN_OUT_KEY);
  }
}

/**
 * Pre-load Clerk headless client before React mounts ClerkProvider.
 * If load hangs (stale JWT), clear storage and retry once.
 */
export async function bootstrapClerk(publishableKey: string): Promise<{ ok: boolean; error?: string }> {
  await prepareAuthStorage();

  if (!publishableKey) {
    return { ok: false, error: "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in artifacts/haulbrokr-mobile/.env" };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const clerk = getClerkInstance({ publishableKey, tokenCache: clerkTokenCache });
      await Promise.race([
        clerk.load({ publishableKey, tokenCache: clerkTokenCache }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Clerk load timed out after 8s — check network and publishable key")),
            CLERK_LOAD_TIMEOUT_MS
          )
        ),
      ]);
      if (clerk.loaded) {
        if (__DEV__) console.log("AUTH bootstrap", { ok: true, attempt });
        return { ok: true };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Clerk load failed";
      if (__DEV__) console.warn("AUTH bootstrap attempt failed", { attempt, msg });
      await clearClerkSessionTokens();
      if (attempt === 1) return { ok: false, error: msg };
    }
  }

  return { ok: false, error: "Clerk failed to load" };
}

/** Clerk keeps a module singleton; after clearing JWT we must reload the JS bundle. */
export function reloadApp() {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.location.reload();
    return;
  }
  if (__DEV__) {
    DevSettings.reload();
    return;
  }
  try {
    // Optional — only present in EAS/update builds.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require("expo-updates") as { reloadAsync?: () => Promise<void> };
    void Updates.reloadAsync?.();
  } catch {
    // Fall back to navigation-only reset when reload isn't available.
  }
}
