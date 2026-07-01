export async function performAccountSignOut(input: {
  signOut: () => Promise<unknown>;
  replace: (path: string) => void;
  onError: (message: string) => void;
}): Promise<void> {
  try {
    await input.signOut();
    input.replace("/sign-in");
  } catch (err: any) {
    input.onError(err?.message ?? "Please try again.");
  }
}
