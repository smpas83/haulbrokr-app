import type { ComponentProps, ElementType, ReactNode } from "react";
import { AlertCircle, ArrowRight, MapPin } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Card as BaseCard,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Intent = "primary" | "secondary" | "success" | "warning" | "danger" | "accent" | "muted";

const intentClass: Record<Intent, string> = {
  primary: "bg-primary text-primary-foreground border-primary",
  secondary: "bg-secondary text-secondary-foreground border-secondary-border",
  success: "bg-success text-success-foreground border-success",
  warning: "bg-warning text-warning-foreground border-warning",
  danger: "bg-destructive text-destructive-foreground border-destructive",
  accent: "bg-accent text-accent-foreground border-accent",
  muted: "bg-muted text-muted-foreground border-border",
};

function PrimaryButton({ className, ...props }: ButtonProps) {
  return <Button className={cn("rounded-none font-bold", className)} {...props} />;
}

function SecondaryButton({ className, variant = "outline", ...props }: ButtonProps) {
  return <Button variant={variant} className={cn("rounded-none border-2 font-semibold", className)} {...props} />;
}

function Card({ className, ...props }: ComponentProps<typeof BaseCard>) {
  return <BaseCard className={cn("rounded-none border-2", className)} {...props} />;
}

function GlassCard({ className, ...props }: ComponentProps<typeof BaseCard>) {
  return <Card className={cn("bg-card/80 backdrop-blur", className)} {...props} />;
}

function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("space-y-4", className)} {...props} />;
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  accent,
  onClick,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "text-left rounded-none border p-4 transition-colors w-full",
        onClick ? "hover:border-primary hover:bg-muted/40 cursor-pointer" : "cursor-default",
        accent && "border-primary/40 bg-primary/5",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{hint ?? ""}</span>
        {onClick ? <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" /> : null}
      </div>
    </button>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  accent,
  sub,
  className,
}: {
  title: string;
  value: string | number;
  icon: ElementType;
  accent?: boolean;
  sub?: string;
  className?: string;
}) {
  return (
    <Card className={cn(accent && "border-primary/30 bg-primary/5", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={cn("text-sm font-semibold uppercase tracking-wider", accent ? "text-primary" : "text-muted-foreground")}>
          {title}
        </CardTitle>
        <Icon className={cn("h-4 w-4", accent ? "text-primary" : "text-muted-foreground")} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-black tracking-tight", accent && "text-primary")}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StatusPill({
  children,
  intent = "muted",
  className,
  ...props
}: ComponentProps<typeof Badge> & { intent?: Intent }) {
  return (
    <Badge className={cn("rounded-none font-bold uppercase text-[10px]", intentClass[intent], className)} {...props}>
      {children}
    </Badge>
  );
}

function Notification({
  title,
  children,
  intent = "primary",
  icon,
  className,
}: {
  title: string;
  children: ReactNode;
  intent?: Extract<Intent, "primary" | "warning" | "danger" | "success">;
  icon?: ReactNode;
  className?: string;
}) {
  const tone = {
    primary: "border-primary/50 bg-primary/10 text-primary",
    warning: "border-warning/50 bg-warning/10 text-warning",
    danger: "border-destructive/50 bg-destructive/10 text-destructive",
    success: "border-success/50 bg-success/10 text-success",
  }[intent];

  return (
    <Alert className={cn("rounded-none border-2", tone, className)}>
      {icon ?? <AlertCircle className="h-4 w-4" />}
      <AlertTitle className="font-bold">{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function LoadingSpinner({ className, ...props }: ComponentProps<typeof Spinner>) {
  return <Spinner className={cn("h-8 w-8 text-primary", className)} {...props} />;
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("bg-card border-2 border-dashed border-border rounded-none", className)}>
      <EmptyHeader>
        {icon && <EmptyMedia>{icon}</EmptyMedia>}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

function MapContainer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("relative overflow-hidden bg-muted border-2 border-border", className)} {...props} />;
}

function MapMarker({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("absolute flex items-center gap-1 text-xs font-semibold text-map-marker", className)} {...props}>
      {children ?? <MapPin className="h-4 w-4" />}
    </div>
  );
}

const TruckMarker = MapMarker;
const DriverMarker = MapMarker;
const JobMarker = MapMarker;

function RoutePolyline({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("absolute border-t-2 border-map-route", className)} {...props} />;
}

function ETAOverlay({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("absolute bg-card/90 border border-border px-2 py-1 text-xs font-semibold", className)} {...props} />;
}

function FleetLayer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("absolute inset-0", className)} {...props} />;
}

const CustomerLayer = FleetLayer;

export {
  PrimaryButton,
  SecondaryButton,
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  GlassCard,
  MetricCard,
  StatCard,
  Panel,
  StatusPill,
  Notification,
  LoadingSpinner,
  Skeleton,
  EmptyState,
  MapContainer,
  TruckMarker,
  DriverMarker,
  JobMarker,
  RoutePolyline,
  ETAOverlay,
  FleetLayer,
  CustomerLayer,
};
