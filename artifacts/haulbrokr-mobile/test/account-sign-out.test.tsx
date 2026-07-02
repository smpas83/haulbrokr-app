import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Alert, type AlertButton } from "react-native";
import { router } from "expo-router";
import * as ClerkExpo from "@clerk/expo";

import AccountScreen from "@/app/(tabs)/account";

vi.mock("expo-web-browser", () => ({
  openAuthSessionAsync: vi.fn(async () => ({ type: "success" })),
}));

vi.mock("expo-linking", () => ({
  createURL: (path: string) => `haulbrokr://${path}`,
}));

vi.mock("@/context/AppContext", () => ({
  useApp: () => ({
    profile: {
      name: "Jane Hauler",
      company: "Acme Trucking",
      phone: "(555) 010-1000",
      city: "Austin",
      state: "TX",
      role: "customer",
      rating: 4.9,
      totalHauls: 12,
      memberSince: "Jan 2026",
    },
    isOnline: false,
    setIsOnline: vi.fn(),
  }),
}));

vi.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#000",
    foreground: "#fff",
    mutedForeground: "#aaa",
    card: "#111",
    border: "#333",
    primary: "#e9a600",
    primaryForeground: "#000",
    secondary: "#172033",
    destructive: "#f87171",
  }),
}));

vi.mock("@/hooks/useUnreadCount", () => ({
  useUnreadCount: () => 0,
}));

vi.mock("@/hooks/useLiveApi", () => {
  const query = (data: any) => ({
    data,
    isFetching: false,
    isLoading: false,
    isError: false,
    dataUpdatedAt: 0,
    refetch: vi.fn(async () => ({ data })),
  });
  const mutation = () => ({
    isPending: false,
    mutateAsync: vi.fn(async () => ({})),
  });

  return {
    useCompliance: () => query({}),
    useSubmitCompliance: mutation,
    useVerifyCompliance: mutation,
    useCreditApplication: () => query({}),
    useSubmitCreditApplication: mutation,
    useQBStatus: () => query({ connected: false }),
    useQBConnect: mutation,
    useQBSync: mutation,
    useQBDisconnect: mutation,
    usePayoutStatus: () => query({ connected: false, payoutsEnabled: false }),
    useConnectStripe: mutation,
    useMyProfile: () => query({ role: "customer" }),
    useAdminAccess: () => query({ isAdmin: false, permissions: [] }),
    useAdminCompliance: () => query([]),
    useAdminCreditApplications: () => query([]),
    useStuckPayouts: () => query([]),
    useWallet: () => query({ availableBalance: 0 }),
    useAccountStatus: () => query({}),
    useLiveActivity: () => query([]),
  };
});

beforeEach(() => {
  (ClerkExpo as any).__resetAuthState();
});

describe("AccountScreen sign-out", () => {
  it("confirms sign-out, calls Clerk signOut, then routes to sign-in", async () => {
    const signOut = vi.fn(async () => {});
    (ClerkExpo as any).__setAuthState({ signOut });
    const replace = vi.spyOn(router, "replace").mockImplementation(() => {});
    vi.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons?: AlertButton[]) => {
      buttons?.find((button) => button.text === "Sign Out")?.onPress?.();
    });

    render(<AccountScreen />);

    fireEvent.click(screen.getByText("Sign Out"));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(replace).toHaveBeenCalledWith("/sign-in");
  });

  it("surfaces Clerk signOut failures without navigating away", async () => {
    const signOut = vi.fn(async () => {
      throw new Error("session revoke failed");
    });
    (ClerkExpo as any).__setAuthState({ signOut });
    const replace = vi.spyOn(router, "replace").mockImplementation(() => {});
    const alert = vi.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons?: AlertButton[]) => {
      buttons?.find((button) => button.text === "Sign Out")?.onPress?.();
    });

    render(<AccountScreen />);

    fireEvent.click(screen.getByText("Sign Out"));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Sign out failed", "session revoke failed"));
    expect(replace).not.toHaveBeenCalled();
  });
});
