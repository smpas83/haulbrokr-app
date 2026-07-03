import { memo } from "react";
import { Link } from "wouter";
import {
  ArrowRight, ClipboardList, Download, FileText, Headphones, Plus, Repeat, Receipt,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobRequest } from "@workspace/api-client-react";

interface CustomerQuickActionsProps {
  lastRequest?: JobRequest | null;
}

function QuickActionRow({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="font-semibold text-sm">{label}</span>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
    </>
  );
}

export const CustomerQuickActions = memo(function CustomerQuickActions({
  lastRequest,
}: CustomerQuickActionsProps) {
  const repeatHref = lastRequest
    ? `/requests/new?repeat=${lastRequest.id}`
    : "/requests/new";

  return (
    <Card className="rounded-none border-2 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link href="/requests/new">
          <div className="group flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all bg-card hover:bg-primary/5">
            <QuickActionRow icon={Plus} label="Request Haul" />
          </div>
        </Link>
        <Link href={repeatHref}>
          <div className="group flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all bg-card hover:bg-primary/5">
            <QuickActionRow icon={Repeat} label="Repeat Previous Job" />
          </div>
        </Link>
        <Link href="/requests">
          <div className="group flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all bg-card hover:bg-primary/5">
            <QuickActionRow icon={ClipboardList} label="View Quotes" />
          </div>
        </Link>
        <Link href="/account">
          <div className="group flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all bg-card hover:bg-primary/5">
            <QuickActionRow icon={Download} label="Download Documents" />
          </div>
        </Link>
        <Link href="/jobs">
          <div className="group flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all bg-card hover:bg-primary/5">
            <QuickActionRow icon={Receipt} label="Invoices" />
          </div>
        </Link>
        <Link href="/support">
          <div className="group flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all bg-card hover:bg-primary/5">
            <QuickActionRow icon={Headphones} label="Support" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
});
