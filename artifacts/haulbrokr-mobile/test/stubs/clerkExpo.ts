const defaultAuthState = {
  getToken: async () => "test-token",
  isSignedIn: true,
  isLoaded: true,
  userId: "test-user",
  signOut: async () => {},
};

let authState = { ...defaultAuthState };

export const useAuth = () => authState;

export const useUser = () => ({
  isLoaded: authState.isLoaded,
  isSignedIn: authState.isSignedIn,
  user: authState.isSignedIn ? { id: authState.userId } : null,
});

export const __setAuthState = (next: Partial<typeof defaultAuthState>) => {
  authState = { ...authState, ...next };
};

export const __resetAuthState = () => {
  authState = { ...defaultAuthState };
};
