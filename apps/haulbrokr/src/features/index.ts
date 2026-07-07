/** HaulBrokr marketplace feature identifiers for platform routing. */
export const HAULBROKR_FEATURES = {
  loadBoard: "load-board",
  fleet: "fleet",
  dispatch: "dispatch",
  copilot: "copilot",
  wallet: "wallet",
  compliance: "compliance",
} as const;

export type HaulBrokrFeatureId =
  (typeof HAULBROKR_FEATURES)[keyof typeof HAULBROKR_FEATURES];

export const HAULBROKR_API_PREFIX = "/api/haulbrokr";
export const HAULBROKR_WEB_PREFIX = "/haulbrokr";
