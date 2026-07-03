import { memo } from "react";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusBadgeStatus =
  | "not_submitted"
  | "not_set"
  | "pending"
  | "uploaded"
  | "verified"
  | "approved"
  | "rejected"
  | "missing"
  | "expired"
  | string;

export interface StatusBadgeProps {
  status: StatusBadgeStatus;
  text?: string;
  expiry?: string | null;
  className?: string;
}

function isExpired(expiry?: string | null): boolean {
  return !!expiry && new Date(expiry).getTime() < Date.now();
}

function formatLabel(status: StatusBadgeStatus, text?: string): string {
  if (text) return text;
  if (status === "not_submitted" || status === "not_set") return "Not submitted";
  if (status === "pending" || status === "uploaded") return "Pending review";
  if (status === "verified" || status === "approved") return status === "verified" ? "Verified" : "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "missing") return "Missing";
  if (status === "expired") return "Expired";
  return String(status).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadgeInner({ status, text, expiry, className }: StatusBadgeProps) {
  if (isExpired(expiry) && (status === "verified" || status === "approved")) {
    return (
      <Badge variant="outline" className={cn("rounded-none border-amber-500 text-amber-600", className)}>
        Expired
      </Badge>
    );
  }

  if (status === "verified" || status === "approved") {
    return (
      <Badge className={cn("bg-green-500 hover:bg-green-600 rounded-none", className)}>
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {formatLabel(status, text)}
      </Badge>
    );
  }

  if (status === "pending" || status === "uploaded") {
    return (
      <Badge className={cn("bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-none", className)}>
        <Clock className="w-3 h-3 mr-1" />
        {formatLabel(status, text)}
      </Badge>
    );
  }

  if (status === "rejected") {
    return (
      <Badge variant="destructive" className={cn("rounded-none", className)}>
        <AlertCircle className="w-3 h-3 mr-1" />
        {formatLabel(status, text)}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={cn("rounded-none text-muted-foreground", className)}>
      {formatLabel(status, text)}
    </Badge>
  );
}

export const StatusBadge = memo(StatusBadgeInner);
