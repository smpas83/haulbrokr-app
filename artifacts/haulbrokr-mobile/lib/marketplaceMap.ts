import type { Job, JobStatus } from "@/context/AppContext";

export type MarketplaceLoad = {
  id: string;
  kind: "request" | "job";
  status: string;
  projectName: string;
  material: string;
  pickupAddress: string;
  deliveryAddress: string;
  budgetPerHour: number;
  trucksNeeded: number;
  bidsCount: number;
  latitude: number;
  longitude: number;
  scheduledDate: string;
  distanceMiles?: number;
};

export type MarketplaceTruck = {
  id: number;
  label: string;
  truckType: string;
  status: "available" | "assigned" | "en_route" | "offline";
  latitude: number;
  longitude: number;
  ownerCompany: string;
  headingDegrees: number;
  speedMph: number;
};

export type MarketplaceHeatZone = {
  latitude: number;
  longitude: number;
  radius: number;
  intensity: number;
};

export type MarketplaceMapData = {
  demoMode: boolean;
  generatedAt: string;
  center: { latitude: number; longitude: number };
  loads: MarketplaceLoad[];
  trucks: MarketplaceTruck[];
  heatZones: MarketplaceHeatZone[];
  stats: {
    openLoads: number;
    activeJobs: number;
    availableTrucks: number;
    providers: number;
  };
};

const STATUS_MAP: Record<string, JobStatus> = {
  open: "open",
  bidding: "bidding",
  bid_received: "bidding",
  accepted: "accepted",
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
};

export function marketplaceLoadToJob(load: MarketplaceLoad): Job {
  return {
    id: load.id,
    projectName: load.projectName,
    projectType: "Transport",
    material: load.material,
    quantity: 100,
    quantityUnit: "tons",
    pickupAddress: load.pickupAddress,
    deliveryAddress: load.deliveryAddress,
    budgetPerHour: load.budgetPerHour,
    preferredRate: load.budgetPerHour,
    status: STATUS_MAP[load.status] ?? "open",
    trucksNeeded: load.trucksNeeded,
    scheduledDate: load.scheduledDate.slice(0, 10),
    endDate: load.scheduledDate.slice(0, 10),
    postedAt: load.scheduledDate,
    postedBy: "Marketplace",
    bidsCount: load.bidsCount,
    providerSupplies: false,
    distanceToStart: load.distanceMiles ?? 0,
    distanceToEnd: 0,
    bids: [],
  };
}

export function coordFromMarketplace(load: MarketplaceLoad): { latitude: number; longitude: number } {
  return { latitude: load.latitude, longitude: load.longitude };
}

export function coordFromTruck(truck: MarketplaceTruck): { latitude: number; longitude: number } {
  return { latitude: truck.latitude, longitude: truck.longitude };
}
