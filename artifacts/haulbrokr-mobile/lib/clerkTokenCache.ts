import { tokenCache as clerkTokenCache } from "@clerk/expo/token-cache";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/** Clerk headless client JWT key used by @clerk/expo. */
export const CLERK_CLIENT_JWT_KEY = "__clerk_client_jwt";

/** Set while sign-out is in progress so a crash mid-flow still clears stale JWT on next launch. */
export const CLERK_SIGNOUT_PENDING_KEY = "@haulbrokr/clerk_signout_pending";

/** Set after a successful sign-in; absent means any persisted client JWT is stale. */
export const CLERK_ACTIVE_SESSION_KEY = "@haulbrokr/clerk_active_session";

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

/** Wipe all Clerk local auth state (SecureStore + AsyncStorage markers). */
export async function resetAllClerkLocalState() {
  await Promise.all([
    clearClerkClientJwt(),
    AsyncStorage.multiRemove([CLERK_SIGNOUT_PENDING_KEY, CLERK_ACTIVE_SESSION_KEY]),
  ]);
}

function isBenignSignOutError(err: unknown) {
  const msg =
    (err as any)?.errors?.[0]?.message ??
    (err as any)?.errors?.[0]?.longMessage ??
    (err as any)?.message ??
    "";
  return /signed out|signed_out|already signed|session.*not found|not signed in/i.test(msg);
}

/**
 * Sign out via Clerk, then clear persisted client JWT.
 * JWT must be cleared after signOut (not before) so Clerk can finish cleanly.
 */
export async function signOutAndClearLocalState(signOut: () => Promise<void>) {
  await markClerkSignOutPending();
  try {
    await signOut();
  } catch (err) {
    if (!isBenignSignOutError(err)) {
      await clearClerkSignOutPending();
      throw err;
    }
  }
  await clearClerkClientJwt();
  await clearClerkActiveSession();
  await clearClerkSignOutPending();
}

/**
 * Before Clerk mounts: remove orphaned client JWT (persisted JWT without an
 * active session marker). This is the root cause of isLoaded staying false.
 */
export async function recoverStaleClientJwtOnStartup() {
  const [pendingSignOut, hasActiveSession, clientJwt] = await Promise.all([
    AsyncStorage.getItem(CLERK_SIGNOUT_PENDING_KEY),
    AsyncStorage.getItem(CLERK_ACTIVE_SESSION_KEY),
    readClientJwt(),
  ]);

  const orphanedJwt = !!clientJwt && hasActiveSession !== "1";
  const shouldClear = pendingSignOut === "1" || orphanedJwt;

  if (!shouldClear) {
    return;
  }

  await resetAllClerkLocalState();
}

/** After Clerk loads for a signed-in user, persist the session marker. */
export async function syncClerkSessionStorage(isLoaded: boolean, isSignedIn: boolean) {
  if (!isLoaded || !isSignedIn) return;
  await markClerkActiveSession();
}
