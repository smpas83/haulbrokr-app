import type { WorkspaceKey } from "@kip/agents";

export type MetricTrend = "up" | "down" | "flat";

export type MetricDefinition = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly trend: MetricTrend;
  readonly owner: string;
  readonly decisionUse: string;
};

export type AnalyticsDashboard = {
  readonly workspace: WorkspaceKey;
  readonly title: string;
  readonly cadence: "live" | "daily" | "weekly";
  readonly metrics: readonly MetricDefinition[];
  readonly narrative: string;
};

const sharedMetrics = [
  {
    id: "priority-throughput",
    label: "Priority throughput",
    value: "87%",
    trend: "up",
    owner: "Chief of Staff",
    decisionUse: "Shows whether today's committed priorities are moving through the operating system."
  },
  {
    id: "approval-age",
    label: "Approval queue age",
    value: "2.4h",
    trend: "down",
    owner: "Operations",
    decisionUse: "Highlights stalled decisions before they block customer, finance, or engineering work."
  },
  {
    id: "memory-confidence",
    label: "Memory confidence",
    value: "94%",
    trend: "up",
    owner: "Research",
    decisionUse: "Measures how often retrieved memory has strong source, recency, and confidence scores."
  }
] as const satisfies readonly MetricDefinition[];

const companyMetricMap = {
  haulbrokr: [
    {
      id: "active-loads",
      label: "Active loads",
      value: "42",
      trend: "up",
      owner: "HaulBrokr Dispatch",
      decisionUse: "Balances dispatch attention between active freight, exceptions, and carrier coverage."
    },
    {
      id: "carrier-readiness",
      label: "Carrier readiness",
      value: "91%",
      trend: "up",
      owner: "HaulBrokr Compliance",
      decisionUse: "Shows whether capacity is compliant and ready before demand is accepted."
    }
  ],
  merchnow: [
    {
      id: "store-coverage",
      label: "Store coverage",
      value: "78%",
      trend: "up",
      owner: "MerchNow Merchandiser Growth",
      decisionUse: "Tracks field capacity against committed retail coverage."
    },
    {
      id: "photo-pass-rate",
      label: "Photo pass rate",
      value: "96%",
      trend: "flat",
      owner: "MerchNow Photo Compliance",
      decisionUse: "Indicates proof-of-work quality and where manual review is needed."
    }
  ],
  gwfg: [
    {
      id: "line-attainment",
      label: "Line attainment",
      value: "89%",
      trend: "up",
      owner: "Golden West Control Tower",
      decisionUse: "Compares production execution against plan across shifts and lines."
    },
    {
      id: "inventory-risk",
      label: "Inventory risk",
      value: "7 SKUs",
      trend: "down",
      owner: "Golden West Inventory",
      decisionUse: "Identifies shortages and lot issues before they hit production."
    }
  ],
  stratus: [
    {
      id: "project-risk",
      label: "Project risk",
      value: "4 elevated",
      trend: "down",
      owner: "Stratus Projects",
      decisionUse: "Surfaces project commitments that need client, staffing, or vendor action."
    },
    {
      id: "invoice-cycle",
      label: "Invoice cycle",
      value: "5.1d",
      trend: "down",
      owner: "Stratus Accounting",
      decisionUse: "Measures how quickly completed work moves into billable cash flow."
    }
  ],
  personal: [
    {
      id: "focus-blocks",
      label: "Focus blocks protected",
      value: "11",
      trend: "up",
      owner: "Executive Assistant",
      decisionUse: "Shows whether deep work capacity is being defended on the calendar."
    },
    {
      id: "personal-followups",
      label: "Open follow-ups",
      value: "8",
      trend: "down",
      owner: "Chief of Staff",
      decisionUse: "Keeps personal commitments from leaking across company priorities."
    }
  ]
} as const satisfies Record<WorkspaceKey, readonly MetricDefinition[]>;

export function createAnalyticsDashboard(workspace: WorkspaceKey, companyName: string): AnalyticsDashboard {
  return {
    workspace,
    title: `${companyName} Command Analytics`,
    cadence: "live",
    metrics: [...sharedMetrics, ...companyMetricMap[workspace]],
    narrative: "A live operating view combining company-specific execution metrics with cross-company leadership signals."
  };
}
