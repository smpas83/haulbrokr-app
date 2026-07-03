import { memo } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, AsyncSection } from "@/components/shared";
import type { Truck } from "@workspace/api-client-react";

interface CompliancePanelProps {
  w9Status?: string;
  insuranceStatus?: string;
  dotCdlStatus?: string;
  payoutStatus?: string;
  trucks?: Truck[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export const CompliancePanel = memo(function CompliancePanel({
  w9Status,
  insuranceStatus,
  dotCdlStatus,
  payoutStatus,
  trucks = [],
  isLoading,
  isError,
  onRetry,
}: CompliancePanelProps) {
  const missingCoi = trucks.filter((t) => !t.coiStatus || t.coiStatus === "none").length;
  const expiringCoi = trucks.filter((t) => t.coiStatus === "expired" || t.coiStatus === "pending").length;
  const safetyAlerts = trucks.filter((t) => t.coiStatus === "expired").length;

  const complianceRows = [
    { label: "Insurance Status", status: insuranceStatus ?? "not_submitted" },
    { label: "DOT Compliance", status: dotCdlStatus ?? "not_submitted" },
    { label: "Missing Documents", status: missingCoi > 0 ? "pending" : "verified", count: missingCoi },
    { label: "Expiring Documents", status: expiringCoi > 0 ? "pending" : "verified", count: expiringCoi },
    { label: "Driver Certifications", status: dotCdlStatus ?? "not_submitted" },
    { label: "Safety Alerts", status: safetyAlerts > 0 ? "pending" : "verified", count: safetyAlerts },
  ];

  return (
    <Card className="rounded-none border-2 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Compliance
        </CardTitle>
        <CardDescription>Insurance, DOT, documents, and safety from existing APIs</CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncSection
          isLoading={isLoading}
          isError={isError}
          onRetry={onRetry}
          skeletonHeight="h-40"
        >
          <ul className="space-y-2" aria-label="Compliance checklist">
            {complianceRows.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between py-2 px-3 border border-border/50 bg-muted/20"
              >
                <span className="text-sm font-semibold">{row.label}</span>
                <div className="flex items-center gap-2">
                  {row.count !== undefined && row.count > 0 && (
                    <span className="text-xs font-bold text-destructive">{row.count}</span>
                  )}
                  <StatusBadge status={row.status} />
                </div>
              </li>
            ))}
          </ul>

          {(w9Status === "rejected" || insuranceStatus === "rejected" || dotCdlStatus === "rejected") && (
            <div className="mt-3 flex items-start gap-2 p-3 border-2 border-destructive/30 bg-destructive/5 text-sm">
              <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-destructive font-semibold">
                Compliance action required — review your account documents.
              </p>
            </div>
          )}

          {payoutStatus && payoutStatus !== "verified" && (
            <div className="mt-2 text-xs text-muted-foreground">
              Payout status: <StatusBadge status={payoutStatus} />
            </div>
          )}
        </AsyncSection>
      </CardContent>
    </Card>
  );
});
