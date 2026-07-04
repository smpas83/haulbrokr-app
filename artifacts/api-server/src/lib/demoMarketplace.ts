/**
 * Synthetic nationwide marketplace data used when production has zero live loads.
 * Coordinates are pre-computed so clients render immediately without geocoding.
 */

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

export type MarketplacePayload = {
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

const US_CITIES: { city: string; state: string; lat: number; lng: number }[] = [
  { city: "Dallas", state: "TX", lat: 32.7767, lng: -96.797 },
  { city: "Houston", state: "TX", lat: 29.7604, lng: -95.3698 },
  { city: "Austin", state: "TX", lat: 30.2672, lng: -97.7431 },
  { city: "San Antonio", state: "TX", lat: 29.4241, lng: -98.4936 },
  { city: "Fort Worth", state: "TX", lat: 32.7555, lng: -97.3308 },
  { city: "Phoenix", state: "AZ", lat: 33.4484, lng: -112.074 },
  { city: "Los Angeles", state: "CA", lat: 34.0522, lng: -118.2437 },
  { city: "San Diego", state: "CA", lat: 32.7157, lng: -117.1611 },
  { city: "San Francisco", state: "CA", lat: 37.7749, lng: -122.4194 },
  { city: "Sacramento", state: "CA", lat: 38.5816, lng: -121.4944 },
  { city: "Denver", state: "CO", lat: 39.7392, lng: -104.9903 },
  { city: "Seattle", state: "WA", lat: 47.6062, lng: -122.3321 },
  { city: "Portland", state: "OR", lat: 45.5152, lng: -122.6784 },
  { city: "Las Vegas", state: "NV", lat: 36.1699, lng: -115.1398 },
  { city: "Salt Lake City", state: "UT", lat: 40.7608, lng: -111.891 },
  { city: "Atlanta", state: "GA", lat: 33.749, lng: -84.388 },
  { city: "Miami", state: "FL", lat: 25.7617, lng: -80.1918 },
  { city: "Tampa", state: "FL", lat: 27.9506, lng: -82.4572 },
  { city: "Orlando", state: "FL", lat: 28.5383, lng: -81.3792 },
  { city: "Jacksonville", state: "FL", lat: 30.3322, lng: -81.6557 },
  { city: "Charlotte", state: "NC", lat: 35.2271, lng: -80.8431 },
  { city: "Raleigh", state: "NC", lat: 35.7796, lng: -78.6382 },
  { city: "Nashville", state: "TN", lat: 36.1627, lng: -86.7816 },
  { city: "Memphis", state: "TN", lat: 35.1495, lng: -90.049 },
  { city: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298 },
  { city: "Indianapolis", state: "IN", lat: 39.7684, lng: -86.1581 },
  { city: "Detroit", state: "MI", lat: 42.3314, lng: -83.0458 },
  { city: "Columbus", state: "OH", lat: 39.9612, lng: -82.9988 },
  { city: "Cleveland", state: "OH", lat: 41.4993, lng: -81.6944 },
  { city: "Cincinnati", state: "OH", lat: 39.1031, lng: -84.512 },
  { city: "Minneapolis", state: "MN", lat: 44.9778, lng: -93.265 },
  { city: "Kansas City", state: "MO", lat: 39.0997, lng: -94.5786 },
  { city: "St. Louis", state: "MO", lat: 38.627, lng: -90.1994 },
  { city: "New Orleans", state: "LA", lat: 29.9511, lng: -90.0715 },
  { city: "Birmingham", state: "AL", lat: 33.5186, lng: -86.8104 },
  { city: "Oklahoma City", state: "OK", lat: 35.4676, lng: -97.5164 },
  { city: "Tulsa", state: "OK", lat: 36.154, lng: -95.9928 },
  { city: "Albuquerque", state: "NM", lat: 35.0844, lng: -106.6504 },
  { city: "Boise", state: "ID", lat: 43.615, lng: -116.2023 },
  { city: "Boston", state: "MA", lat: 42.3601, lng: -71.0589 },
  { city: "New York", state: "NY", lat: 40.7128, lng: -74.006 },
  { city: "Philadelphia", state: "PA", lat: 39.9526, lng: -75.1652 },
  { city: "Pittsburgh", state: "PA", lat: 40.4406, lng: -79.9959 },
  { city: "Baltimore", state: "MD", lat: 39.2904, lng: -76.6122 },
  { city: "Washington", state: "DC", lat: 38.9072, lng: -77.0369 },
  { city: "Richmond", state: "VA", lat: 37.5407, lng: -77.436 },
  { city: "Virginia Beach", state: "VA", lat: 36.8529, lng: -75.978 },
  { city: "Milwaukee", state: "WI", lat: 43.0389, lng: -87.9065 },
  { city: "Louisville", state: "KY", lat: 38.2527, lng: -85.7585 },
];

const MATERIALS = [
  "dirt",
  "gravel",
  "concrete",
  "asphalt",
  "demolition",
  "sand",
  "topsoil",
  "fill",
] as const;
const LOAD_STATUSES = [
  "open",
  "bidding",
  "bid_received",
  "accepted",
  "in_progress",
] as const;
const TRUCK_TYPES = [
  "dump_truck",
  "end_dump",
  "belly_dump",
  "super_10",
  "transfer",
] as const;
const TRUCK_STATUSES = ["available", "assigned", "en_route"] as const;
const CARRIER_NAMES = [
  "Lone Star Hauling",
  "Metro Dirt Co",
  "Capitol Transport",
  "Sunbelt Trucking",
  "Rocky Mountain Haulers",
  "Gulf Coast Carriers",
  "Midwest Express",
  "Pacific Dump Services",
  "Southern Soil Movers",
  "Great Plains Fleet",
  "Desert Ridge Trucking",
  "Bay Area Haulers",
  "Heartland Transport",
  "Prairie State Hauling",
  "Blue Ridge Carriers",
  "Delta Dirt Works",
];

const PROJECT_PREFIXES = [
  "Highway Expansion",
  "Commercial Pad",
  "Residential Subdivision",
  "Quarry Run",
  "Site Grading",
  "Foundation Excavation",
  "Parking Lot Demo",
  "Pipeline Trench",
  "Retail Pad Build",
  "Industrial Park",
  "School Expansion",
  "Bridge Approach",
];

function jitter(base: number, spread: number, seed: number): number {
  const x = Math.sin(seed * 12.9898 + base * 78.233) * 43758.5453;
  return base + (x - Math.floor(x) - 0.5) * spread;
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function streetAddress(seed: number): string {
  const num = 100 + (Math.abs(seed) % 8900);
  const streets = [
    "Industrial Blvd",
    "Commerce Dr",
    "Quarry Rd",
    "Highway 75 Frontage",
    "Construction Way",
    "Haul Rd",
  ];
  return `${num} ${pick(streets, seed)}`;
}

/** Build 250 nationwide demo loads with embedded coordinates. */
export function buildDemoLoads(count = 250): MarketplaceLoad[] {
  const loads: MarketplaceLoad[] = [];
  for (let i = 0; i < count; i++) {
    const city = pick(US_CITIES, i);
    const material = pick(MATERIALS, i * 3);
    const status = pick(LOAD_STATUSES, i * 7);
    const lat = jitter(city.lat, 0.35, i);
    const lng = jitter(city.lng, 0.35, i + 1000);
    const deliveryCity = pick(US_CITIES, i + 17);
    loads.push({
      id:
        status === "in_progress" || status === "accepted"
          ? String(10000 + i)
          : `req-demo-${i + 1}`,
      kind:
        status === "in_progress" || status === "accepted" ? "job" : "request",
      status,
      projectName: `${pick(PROJECT_PREFIXES, i)} — ${city.city}`,
      material,
      pickupAddress: `${streetAddress(i)}, ${city.city}, ${city.state}`,
      deliveryAddress: `${streetAddress(i + 500)}, ${deliveryCity.city}, ${deliveryCity.state}`,
      budgetPerHour: 85 + (i % 45),
      trucksNeeded: 1 + (i % 4),
      bidsCount:
        status === "open" ? i % 8 : status === "bidding" ? 2 + (i % 6) : 0,
      latitude: lat,
      longitude: lng,
      scheduledDate: new Date(Date.now() + (i % 14) * 86400000).toISOString(),
    });
  }
  return loads;
}

/** Build 150 nationwide demo trucks with slight motion offsets. */
export function buildDemoTrucks(count = 150): MarketplaceTruck[] {
  const now = Date.now();
  const phase = (now / 60000) % 360;
  const trucks: MarketplaceTruck[] = [];
  for (let i = 0; i < count; i++) {
    const city = pick(US_CITIES, i * 2);
    const status = pick(TRUCK_STATUSES, i * 5);
    const motion = Math.sin((phase + i * 13) * (Math.PI / 180)) * 0.08;
    trucks.push({
      id: i + 1,
      label: `Truck ${String(i + 1).padStart(3, "0")}`,
      truckType: pick(TRUCK_TYPES, i),
      status,
      latitude: jitter(city.lat + motion, 0.25, i + 200),
      longitude: jitter(city.lng + motion * 0.7, 0.25, i + 300),
      ownerCompany: pick(CARRIER_NAMES, i),
      headingDegrees: (i * 37 + phase) % 360,
      speedMph:
        status === "en_route" ? 28 + (i % 22) : status === "assigned" ? 0 : 0,
    });
  }
  return trucks;
}

/** Surge heat zones anchored to high open-load density metros. */
export function buildDemoHeatZones(
  loads: MarketplaceLoad[],
): MarketplaceHeatZone[] {
  const openByCity = new Map<
    string,
    { lat: number; lng: number; count: number }
  >();
  for (const load of loads) {
    if (!["open", "bidding", "bid_received"].includes(load.status)) continue;
    const key = `${load.latitude.toFixed(1)},${load.longitude.toFixed(1)}`;
    const cur = openByCity.get(key) ?? {
      lat: load.latitude,
      lng: load.longitude,
      count: 0,
    };
    cur.count += 1;
    openByCity.set(key, cur);
  }
  return [...openByCity.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map((z) => ({
      latitude: z.lat,
      longitude: z.lng,
      radius: 6000 + z.count * 400,
      intensity: Math.min(1, z.count / 8),
    }));
}

export function buildDemoMarketplace(): MarketplacePayload {
  const loads = buildDemoLoads(250);
  const trucks = buildDemoTrucks(150);
  const openLoads = loads.filter((l) =>
    ["open", "bidding", "bid_received"].includes(l.status),
  ).length;
  const activeJobs = loads.filter((l) =>
    ["accepted", "in_progress"].includes(l.status),
  ).length;
  return {
    demoMode: true,
    generatedAt: new Date().toISOString(),
    center: { latitude: 39.8283, longitude: -98.5795 },
    loads,
    trucks,
    heatZones: buildDemoHeatZones(loads),
    stats: {
      openLoads,
      activeJobs,
      availableTrucks: trucks.filter((t) => t.status === "available").length,
      providers: 50,
    },
  };
}
