import * as SecureStore from "expo-secure-store";

/** Clerk Expo stores the headless client JWT under this SecureStore key. */
export const CLERK_CLIENT_JWT_KEY = "__clerk_client_jwt";

const secureStoreOpts: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const clerkTokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key, secureStoreOpts);
    } catch {
      await SecureStore.deleteItemAsync(key, secureStoreOpts).catch(() => {});
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value, secureStoreOpts);
    } catch {}
  },
  clearToken(key: string) {
    void SecureStore.deleteItemAsync(key, secureStoreOpts).catch(() => {});
  },
};

/** Remove persisted Clerk client JWT so the next load starts signed-out. */
export async function clearClerkSessionTokens() {
  await SecureStore.deleteItemAsync(CLERK_CLIENT_JWT_KEY, secureStoreOpts).catch(() => {});
  clerkTokenCache.clearToken(CLERK_CLIENT_JWT_KEY);
}
