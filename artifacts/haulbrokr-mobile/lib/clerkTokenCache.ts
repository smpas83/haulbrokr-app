import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { DevSettings, Platform } from "react-native";

/** Clerk Expo stores the headless client JWT under this SecureStore key. */
export const CLERK_CLIENT_JWT_KEY = "__clerk_client_jwt";

const PENDING_SIGN_OUT_KEY = "haulbrokr:pending_sign_out";

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
