import { tokenCache as clerkTokenCache } from "@clerk/expo/token-cache";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/** Clerk headless client JWT key used by @clerk/expo. */
export const CLERK_CLIENT_JWT_KEY = "__clerk_client_jwt";

/** Set while sign-out is in progress so a crash mid-flow still clears stale JWT on next launch. */
export const CLERK_SIGNOUT_PENDING_KEY = "@haulbrokr/clerk_signout_pending";

/** Set after a successful sign-in; absent means any persisted client JWT is stale. */
export const CLERK_ACTIVE_SESSION_KEY = "@haulbrokr/clerk_active_session";

/**
 * Set when this install has a valid Clerk client identity (signed in, or signed out cleanly).
 * Used to preserve the client JWT across sign-out so Client Trust does not re-prompt every login.
 */
export const CLERK_TRUSTED_CLIENT_KEY = "@haulbrokr/clerk_trusted_client";

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
    return await SecureStore.getItemAsync(
      CLERK_CLIENT_JWT_KEY,
      secureStoreOpts,
    );
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

/** Remove the persisted client JWT. Only for full reset or orphaned stale JWT recovery. */
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
  await AsyncStorage.multiSet([
    [CLERK_ACTIVE_SESSION_KEY, "1"],
    [CLERK_TRUSTED_CLIENT_KEY, "1"],
  ]);
}

export async function markClerkTrustedClient() {
  await AsyncStorage.setItem(CLERK_TRUSTED_CLIENT_KEY, "1");
}

export async function clearClerkActiveSession() {
  await AsyncStorage.removeItem(CLERK_ACTIVE_SESSION_KEY);
}

export async function clearClerkTrustedClient() {
  await AsyncStorage.removeItem(CLERK_TRUSTED_CLIENT_KEY);
}

/** Wipe all Clerk local auth state (SecureStore + AsyncStorage markers). */
export async function resetAllClerkLocalState() {
  await Promise.all([
    clearClerkClientJwt(),
    AsyncStorage.multiRemove([
      CLERK_SIGNOUT_PENDING_KEY,
      CLERK_ACTIVE_SESSION_KEY,
      CLERK_TRUSTED_CLIENT_KEY,
    ]),
  ]);
}

function isBenignSignOutError(err: unknown) {
  const msg =
    (err as any)?.errors?.[0]?.message ??
    (err as any)?.errors?.[0]?.longMessage ??
    (err as any)?.message ??
    "";
  return /signed out|signed_out|already signed|session.*not found|not signed in/i.test(
    msg,
  );
}

/**
 * Sign out via Clerk, then clear session markers only.
 * Keep the client JWT so Clerk still recognizes this device (Client Trust).
 * JWT is only wiped on interrupted sign-out or orphaned stale JWT recovery.
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
  await clearClerkActiveSession();
  await markClerkTrustedClient();
  await clearClerkSignOutPending();
}

/**
 * Before Clerk mounts: remove orphaned client JWT (stale session reference without
 * markers). Preserves client JWT after a clean sign-out so Client Trust won't
 * re-prompt on every password login.
 */
export async function recoverStaleClientJwtOnStartup() {
  const [pendingSignOut, hasActiveSession, hasTrustedClient, clientJwt] =
    await Promise.all([
      AsyncStorage.getItem(CLERK_SIGNOUT_PENDING_KEY),
      AsyncStorage.getItem(CLERK_ACTIVE_SESSION_KEY),
      AsyncStorage.getItem(CLERK_TRUSTED_CLIENT_KEY),
      readClientJwt(),
    ]);

  if (pendingSignOut === "1") {
    await resetAllClerkLocalState();
    return;
  }

  const orphanedJwt =
    !!clientJwt && hasActiveSession !== "1" && hasTrustedClient !== "1";
  if (orphanedJwt) {
    await resetAllClerkLocalState();
  }
}

/** After Clerk loads for a signed-in user, persist the session marker. */
export async function syncClerkSessionStorage(
  isLoaded: boolean,
  isSignedIn: boolean,
) {
  if (!isLoaded || !isSignedIn) return;
  await markClerkActiveSession();
}
