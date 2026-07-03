import { memo } from "react";
import { Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared";

const MAINTENANCE_ITEMS = [
  "Scheduled Maintenance",
  "Oil Changes",
  "Tires",
  "Brake Inspection",
  "Registration",
  "Permits",
  "Inspection Due",
] as const;

export const MaintenancePanel = memo(function MaintenancePanel() {
  return (
    <Card className="rounded-none border-2 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Wrench className="h-4 w-4" aria-hidden="true" />
          Maintenance
        </CardTitle>
        <CardDescription>
          {/* PLACEHOLDER: maintenance tracking API pending — all fields below are placeholders */}
          Awaiting maintenance API integration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2" aria-label="Maintenance checklist">
          {MAINTENANCE_ITEMS.map((item) => (
            <li
              key={item}
              className="flex items-center justify-between py-2 px-3 border border-border/50 bg-muted/20"
            >
              <span className="text-sm font-semibold">{item}</span>
              <StatusBadge status="pending" />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-3 italic">
          PLACEHOLDER: ChatGPT visual package — maintenance schedule and alerts
        </p>
      </CardContent>
    </Card>
  );
});
