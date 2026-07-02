"use client";

import { motion } from "framer-motion";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export type GlassCardProps = ComponentPropsWithoutRef<"section"> & {
  readonly title?: string;
  readonly eyebrow?: string;
  readonly action?: ReactNode;
};

export function GlassCard({ title, eyebrow, action, className, children, ...props }: GlassCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: "easeOut" }}
      className={cx(
        "rounded-[2rem] border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl",
        "ring-1 ring-white/[0.04]",
        className
      )}
      {...props}
    >
      {(title || eyebrow || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">{eyebrow}</p>}
            {title && <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </motion.section>
  );
}

export function StatusPill({
  label,
  tone = "neutral"
}: {
  readonly label: string;
  readonly tone?: "good" | "warning" | "critical" | "neutral";
}) {
  const tones = {
    good: "border-emerald-300/30 bg-emerald-400/15 text-emerald-100",
    warning: "border-amber-300/30 bg-amber-400/15 text-amber-100",
    critical: "border-rose-300/30 bg-rose-400/15 text-rose-100",
    neutral: "border-white/10 bg-white/10 text-slate-200"
  };

  return <span className={cx("rounded-full border px-3 py-1 text-xs font-medium", tones[tone])}>{label}</span>;
}

export function MetricCard({
  label,
  value,
  detail,
  trend
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly trend: "up" | "down" | "flat";
}) {
  const trendLabel = trend === "up" ? "Improving" : trend === "down" ? "Reducing" : "Stable";

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-300">{label}</p>
        <StatusPill label={trendLabel} tone={trend === "flat" ? "neutral" : "good"} />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

export function CommandInput({ value }: { readonly value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-200">
      <span className="grid size-7 place-items-center rounded-full bg-cyan-300 text-xs font-bold text-slate-950">K</span>
      <span className="text-slate-400">Ask KIP</span>
      <span className="min-w-0 flex-1 truncate text-white">{value}</span>
      <kbd className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
        command
      </kbd>
    </div>
  );
}

export function Waveform({ bars = 24 }: { readonly bars?: number }) {
  return (
    <div className="flex h-12 items-center justify-center gap-1">
      {Array.from({ length: bars }, (_, index) => (
        <motion.span
          key={index}
          className="w-1 rounded-full bg-cyan-200"
          initial={{ height: 8, opacity: 0.5 }}
          animate={{ height: [8, 30 - (index % 5) * 3, 12], opacity: [0.45, 1, 0.6] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: index * 0.035 }}
        />
      ))}
    </div>
  );
}
