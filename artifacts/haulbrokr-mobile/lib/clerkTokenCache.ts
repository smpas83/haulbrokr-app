import { tokenCache as clerkTokenCache } from "@clerk/expo/token-cache";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/** Clerk headless client JWT key used by @clerk/expo. */
export const CLERK_CLIENT_JWT_KEY = "__clerk_client_jwt";

/** Set while sign-out is in progress so a crash mid-flow still clears stale JWT on next launch. */
export const CLERK_SIGNOUT_PENDING_KEY = "@haulbrokr/clerk_signout_pending";

/** Tracks that the user completed sign-in; used after Clerk has loaded. */
export const CLERK_ACTIVE_SESSION_KEY = "@haulbrokr/clerk_active_session";

/** One-time cleanup for installs stuck before session-marker recovery shipped. */
const STALE_JWT_RECOVERY_KEY = "@haulbrokr/clerk_stale_jwt_recovery_v2";

const secureStoreOpts: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

async function deleteToken(key: string) {
  try {
    await SecureStore.deleteItemAsync(key, secureStoreOpts);
  } catch {
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

/** Remove the persisted client JWT. Required before sign-out completes on native. */
export async function clearClerkClientJwt() {
  await deleteToken(CLERK_CLIENT_JWT_KEY);
}

export async function markClerkSignOutPending() {
  await AsyncStorage.setItem(CLERK_SIGNOUT_PENDING_KEY, "1");
}

export async function clearClerkSignOutPending() {
  await AsyncStorage.removeItem(CLERK_SIGNOUT_PENDING_KEY);
}

export async function markClerkActiveSession() {
  await AsyncStorage.setItem(CLERK_ACTIVE_SESSION_KEY, "1");
}

export async function clearClerkActiveSession() {
  await AsyncStorage.removeItem(CLERK_ACTIVE_SESSION_KEY);
}

/**
 * Clear stale client JWT before Clerk mounts.
 * Handles interrupted sign-outs and one-time recovery for pre-fix installs.
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
    AsyncStorage.removeItem(CLERK_ACTIVE_SESSION_KEY),
    AsyncStorage.setItem(STALE_JWT_RECOVERY_KEY, "1"),
  ]);
}

/**
 * After Clerk loads for a signed-in user, persist a session marker so startup
 * recovery can distinguish stale JWT leftovers from active sessions.
 */
export async function syncClerkSessionStorage(isLoaded: boolean, isSignedIn: boolean) {
  if (!isLoaded || !isSignedIn) return;
  await markClerkActiveSession();
}
