import { tokenCache as clerkTokenCache } from "@clerk/expo/token-cache";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/** Clerk headless client JWT key used by @clerk/expo. */
export const CLERK_CLIENT_JWT_KEY = "__clerk_client_jwt";

/** Set while sign-out is in progress so a crash mid-flow still clears stale JWT on next launch. */
export const CLERK_SIGNOUT_PENDING_KEY = "@haulbrokr/clerk_signout_pending";

/** One-time recovery for devices stuck with a stale client JWT from before sign-out was fixed. */
const STALE_JWT_RECOVERY_KEY = "@haulbrokr/clerk_stale_jwt_recovery_v1";

const secureStoreOpts: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

async function deleteToken(key: string) {
  try {
    await SecureStore.deleteItemAsync(key, secureStoreOpts);
  } catch {
    // Tokens from older builds may lack keychain options.
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  }
}

async function readClientJwt() {
  try {
    return await SecureStore.getItemAsync(CLERK_CLIENT_JWT_KEY, secureStoreOpts);
  } catch {
    try {
      return await SecureStore.getItemAsync(CLERK_CLIENT_JWT_KEY);
    } catch {
      return null;
    }
  }
}

/** Official Clerk token cache plus clearToken for publishable-key rotation. */
export const tokenCache = clerkTokenCache
  ? {
      ...clerkTokenCache,
      clearToken(key: string) {
        void deleteToken(key);
      },
    }
  : undefined;

/**
 * Remove the persisted client JWT before sign-out.
 * Clerk signOut() clears in-memory state but does not clear SecureStore; stale
 * JWTs block the post-sign-out reload (isLoaded stays false).
 */
export async function clearClerkClientJwt() {
  await deleteToken(CLERK_CLIENT_JWT_KEY);
}

export async function markClerkSignOutPending() {
  await AsyncStorage.setItem(CLERK_SIGNOUT_PENDING_KEY, "1");
}

export async function clearClerkSignOutPending() {
  await AsyncStorage.removeItem(CLERK_SIGNOUT_PENDING_KEY);
}

/**
 * Clear orphaned client JWT before Clerk mounts.
 * Handles interrupted sign-outs and one-time recovery for pre-fix stale tokens.
 */
export async function recoverStaleClientJwtOnStartup() {
  const [pendingSignOut, recoveredBefore, clientJwt] = await Promise.all([
    AsyncStorage.getItem(CLERK_SIGNOUT_PENDING_KEY),
    AsyncStorage.getItem(STALE_JWT_RECOVERY_KEY),
    readClientJwt(),
  ]);

  const shouldClear =
    pendingSignOut === "1" ||
    (!recoveredBefore && !!clientJwt);

  if (!shouldClear) {
    return;
  }

  await clearClerkClientJwt();

  await Promise.all([
    AsyncStorage.removeItem(CLERK_SIGNOUT_PENDING_KEY),
    AsyncStorage.setItem(STALE_JWT_RECOVERY_KEY, "1"),
  ]);
}
