export type InsightSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface InsightAction {
  label: string;
  href?: string;
  command?: string;
}

export interface OperationInsight {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  confidence: number;
  businessImpact: string;
  recommendedAction: string;
  actions: InsightAction[];
}

export interface OperationsCenterData {
  morningBrief: string;
  todayRevenue: number;
  todayJobs: number;
  fleetStatus: {
    total: number;
    available: number;
    onJob: number;
    offline: number;
  };
  driverAvailability: {
    assigned: number;
    unassigned: number;
  };
  weather: { summary: string; detail: string } | null;
  traffic: { summary: string; detail: string } | null;
  criticalAlerts: { id: string; title: string; description: string; href?: string }[];
  lateJobs: {
    id: number;
    materialType: string;
    scheduledDate: string;
    status: string;
    pickupAddress: string;
  }[];
  highMarginOpportunities: {
    id: number;
    materialType: string;
    budgetPerHour: number | null;
    estimatedMargin: number;
    pickupAddress: string;
  }[];
  insights: OperationInsight[];
  recentActivity: {
    id: number;
    type: string;
    description: string;
    relatedId: number | null;
    relatedBinOrderId: string | null;
    createdAt: string;
  }[];
  upcomingDeliveries: {
    id: number;
    materialType: string;
    deliveryAddress: string;
    scheduledDate: string;
    status: string;
  }[];
  complianceWarnings: { id: string; title: string; detail: string; href: string }[];
  fuelAlerts: { id: string; title: string; detail: string }[];
  liveStream: {
    id: string;
    type: string;
    description: string;
    relatedId?: number;
    href?: string;
    createdAt: string;
  }[];
  dispatchSuggestions: {
    jobId: number;
    materialType: string;
    pickupAddress: string;
    recommendedTruckId: number | null;
    recommendedTruckLabel: string | null;
    backupTruckId: number | null;
    backupTruckLabel: string | null;
    estimatedProfit: number;
    estimatedFuelCost: number;
    lateRisk: "low" | "medium" | "high";
    conflicts: string[];
  }[];
  analytics: {
    revenueForecast7d: number;
    marginForecast7d: number;
    fleetUtilization: number;
    customerLifetimeValue: number;
    vendorScore: number | null;
    driverScore: number | null;
    regionalDemand: { region: string; jobCount: number; trend: number }[];
    weeklyEvents: { label: string; count: number }[];
  };
  digitalTwinHealth: {
    fleetHealth: { score: number; label: string; issues: string[] };
    driverHealth: { score: number; label: string; issues: string[] };
    equipmentHealth: { score: number; label: string; issues: string[] };
    maintenance: { overdue: number; upcoming: number };
    compliance: { status: string; issues: string[] };
    insurance: { status: string; expiringWithin30Days: boolean };
    fuel: { alertCount: number };
    utilization: number;
  };
  updatedAt: string;
}
