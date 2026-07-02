import { tokenCache as clerkTokenCache } from "@clerk/expo/token-cache";
import * as SecureStore from "expo-secure-store";

/** Clerk headless client JWT key used by @clerk/expo. */
export const CLERK_CLIENT_JWT_KEY = "__clerk_client_jwt";

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
