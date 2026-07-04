export type MarketplaceMapData = {
  demoMode: boolean;
  generatedAt: string;
  center: { latitude: number; longitude: number };
  loads: Array<{
    id: string;
    status: string;
    projectName: string;
    material: string;
    pickupAddress: string;
    budgetPerHour: number;
    trucksNeeded: number;
    bidsCount: number;
    latitude: number;
    longitude: number;
  }>;
  trucks: Array<{
    id: number;
    label: string;
    status: string;
    ownerCompany: string;
    latitude: number;
    longitude: number;
  }>;
  heatZones: Array<{ latitude: number; longitude: number; radius: number; intensity: number }>;
  stats: { openLoads: number; activeJobs: number; availableTrucks: number; providers: number };
};

export const MAP_STATUS_COLOR: Record<string, string> = {
  open: "#e9a600",
  bidding: "#3b82f6",
  bid_received: "#3b82f6",
  accepted: "#16a34a",
  in_progress: "#16a34a",
  available: "#22c55e",
  assigned: "#3b82f6",
  en_route: "#e9a600",
};
