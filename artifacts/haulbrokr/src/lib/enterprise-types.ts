export interface EnterpriseHubData {
  workflows: { items: WorkflowItem[]; templates: Record<string, { title: string; slaHours: number; priority: string }> };
  tasks: { items: TaskItem[]; overdue: TaskItem[] };
  documents: { items: DocumentItem[]; expiring: DocumentItem[] };
  scorecards: {
    customer?: CustomerScorecard | null;
    vendor?: VendorScorecard | null;
    driver?: DriverScorecard | null;
  };
  finance: FinanceData;
  fleet: FleetData;
  reports: { saved: ReportItem[]; templates: { key: string; name: string }[] };
  settings: Record<string, unknown>;
  audit: AuditItem[];
  permissions: string[];
  operations: { businessHealth?: Record<string, number>; executiveDigest?: { summary: string; title: string } };
  updatedAt: string;
}

export interface WorkflowItem {
  id: number;
  templateKey: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  slaHours: number | null;
}

export interface TaskItem {
  id: number;
  title: string;
  status: string;
  priority: string;
  entityType: string;
  dueAt: string | null;
}

export interface DocumentItem {
  id: string;
  category: string;
  title: string;
  fileName: string | null;
  expiresAt: string | null;
  status: string;
  href?: string;
}

export interface CustomerScorecard {
  revenue: number;
  lifetimeValue: number;
  openRequests: number;
  activeJobs: number;
  outstandingInvoices: number;
  riskScore: number;
  growthOpportunities: string[];
  aiInsights: string[];
}

export interface VendorScorecard {
  acceptanceRate: number;
  completionRate: number;
  safetyScore: number;
  complianceScore: number;
  revenue: number;
  reliability: number;
}

export interface DriverScorecard {
  completedLoads: number;
  onTimePercent: number;
  safetyScore: number;
  customerRating: string;
  badges: string[];
}

export interface FinanceData {
  revenue: number;
  margins: number;
  accountsReceivable: number;
  outstandingInvoices: number;
  monthRevenue: number;
  profitabilityByRegion: { region: string; revenue: number; loads: number }[];
}

export interface FleetData {
  trucks: { id: number; label: string; truckType: string; isAvailable: boolean; coiStatus: string }[];
  summary: { total: number; available: number; utilization: number; maintenanceDue: number };
  maintenanceSchedule: { truckId: number; task: string; due: string }[];
}

export interface ReportItem {
  id: number;
  name: string;
  lastRunAt: string | null;
}

export interface AuditItem {
  id: number;
  action: string;
  resourceType: string;
  createdAt: string;
}
