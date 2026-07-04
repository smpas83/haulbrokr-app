import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  RefreshingIndicator,
  isRefreshingPillVisible,
} from "@/components/RefreshingIndicator";

/**
 * Coverage for the "Updating…" pill (RefreshingIndicator) and the gating
 * convention every live-data screen uses to decide when to show it.
 *
 * The pill must only surface an *invisible* background refetch — the one the
 * user didn't trigger (e.g. the foreground refetch after reopening the app). It
 * must stay hidden during the initial load (the screen already shows its own
 * skeleton/empty state) and during a manual pull-to-refresh (RefreshControl
 * already shows its own spinner). Doubling up looks broken.
 *
 * Visibility is decided by the shared `isRefreshingPillVisible` helper that
 * every live screen (jobs, dashboard, account, job detail, admin-payouts) now
 * imports — so this test exercises the exact predicate the screens run, not a
 * copy of it. A regression in the helper fails here for all five screens at
 * once.
 */
describe("RefreshingIndicator component contract", () => {
  it("renders nothing when not visible", () => {
    render(<RefreshingIndicator visible={false} />);
    expect(screen.queryByText("Updating…")).toBeNull();
  });

  it("renders the pill with the default label when visible", () => {
    render(<RefreshingIndicator visible />);
    expect(screen.getByText("Updating…")).toBeTruthy();
  });

  it("renders a custom label when provided", () => {
    render(<RefreshingIndicator visible label="Syncing…" />);
    expect(screen.getByText("Syncing…")).toBeTruthy();
    expect(screen.queryByText("Updating…")).toBeNull();
  });
});

describe("RefreshingIndicator gating convention", () => {
  it("stays hidden during the initial load", () => {
    // Initial fetch: React Query reports both isLoading and isFetching true.
    const visible = isRefreshingPillVisible({
      isFetching: true,
      isLoading: true,
      refreshing: false,
    });
    expect(visible).toBe(false);

    render(<RefreshingIndicator visible={visible} />);
    expect(screen.queryByText("Updating…")).toBeNull();
  });

  it("stays hidden during a manual pull-to-refresh", () => {
    // Pull-to-refresh: the local `refreshing` flag is set while RefreshControl
    // shows its own spinner, even though React Query is fetching.
    const visible = isRefreshingPillVisible({
      isFetching: true,
      isLoading: false,
      refreshing: true,
    });
    expect(visible).toBe(false);

    render(<RefreshingIndicator visible={visible} />);
    expect(screen.queryByText("Updating…")).toBeNull();
  });

  it("shows during a background refetch over cached data", () => {
    // Background refetch: cached data already on screen (not loading), no manual
    // pull in progress — this is the only case the pill is meant for.
    const visible = isRefreshingPillVisible({
      isFetching: true,
      isLoading: false,
      refreshing: false,
    });
    expect(visible).toBe(true);

    render(<RefreshingIndicator visible={visible} />);
    expect(screen.getByText("Updating…")).toBeTruthy();
  });

  it("defaults isLoading/refreshing to false for screens that omit them", () => {
    // The dashboard and account screens don't track a single isLoading flag and
    // pass only the OR'd fetching state (plus refreshing). Omitting the optional
    // fields must behave like passing false, so a plain background fetch shows.
    expect(isRefreshingPillVisible({ isFetching: true })).toBe(true);
    expect(isRefreshingPillVisible({ isFetching: false })).toBe(false);
  });

  it("stays hidden when no query is fetching", () => {
    // Idle: nothing in flight, so the pill must never appear regardless of the
    // other flags.
    expect(
      isRefreshingPillVisible({
        isFetching: false,
        isLoading: false,
        refreshing: false,
      }),
    ).toBe(false);
    expect(
      isRefreshingPillVisible({
        isFetching: false,
        isLoading: true,
        refreshing: true,
      }),
    ).toBe(false);
  });
});
