import { describe, expect, it, vi } from "vitest";
import { performAccountSignOut } from "@/lib/accountSignOut";

describe("performAccountSignOut", () => {
  it("signs out and returns to sign-in", async () => {
    const signOut = vi.fn(async () => undefined);
    const replace = vi.fn();
    const onError = vi.fn();

    await performAccountSignOut({ signOut, replace, onError });

    expect(signOut).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/sign-in");
    expect(onError).not.toHaveBeenCalled();
  });

  it("surfaces sign-out failures without navigating", async () => {
    const signOut = vi.fn(async () => {
      throw new Error("Session expired");
    });
    const replace = vi.fn();
    const onError = vi.fn();

    await performAccountSignOut({ signOut, replace, onError });

    expect(replace).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("Session expired");
  });
});
