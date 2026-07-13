import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

/** Rigid dump-truck silhouette (cab + tipping bed) — brand vehicle mark. */
export function DumpTruckIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      {/* Raised dump bed */}
      <path d="M3.5 9.5 L11 4.5 L12.5 11.5 L4.5 14.5 Z" />
      {/* Hydraulic ram */}
      <path d="M8 12.5 L10.5 8.5" />
      {/* Cab */}
      <path d="M13 10.5 H18.5 L20.5 13.5 V17 H13 V10.5 Z" />
      <path d="M15 10.5 V8.5 H18 L19.2 10.5" />
      {/* Chassis */}
      <path d="M4.5 17 H20.5" />
      {/* Wheels */}
      <circle cx="7" cy="17.5" r="1.6" />
      <circle cx="16.5" cy="17.5" r="1.6" />
    </svg>
  );
}
