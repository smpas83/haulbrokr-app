import { useState } from "react";
import { Bot, Send, Sparkles, TrendingUp, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { DumpTruckIcon } from "./dump-truck-icon";

const SUGGESTED_PROMPTS = [
  "Which routes have highest demand today?",
  "Optimize my fleet dispatch for tomorrow",
  "Show revenue forecast for this week",
];

const DEMO_MESSAGES = [
  {
    role: "assistant" as const,
    content: "Good morning! I've analyzed your fleet data. You have 3 dump trucks idle in the Houston area — I found 7 matching loads within 15 miles.",
    insight: { label: "Potential revenue", value: "$4,200", icon: DollarSign },
  },
  {
    role: "user" as const,
    content: "Dispatch the closest dump truck to the gravel load",
  },
  {
    role: "assistant" as const,
    content: "Done. Dump truck #247 (Mike R.) dispatched to gravel load at I-45 & Beltway. ETA 12 min. Customer notified.",
    insight: { label: "Fleet utilization", value: "94%", icon: TrendingUp },
  },
];

export function AiCopilotPreview({ className }: { className?: string }) {
  const [activePrompt, setActivePrompt] = useState<number | null>(null);

  return (
    <div className={cn("surface-panel-elevated rounded-2xl overflow-hidden flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">HaulBrokr AI</p>
            <p className="text-xs text-muted-foreground">Example conversation</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-medium">Preview</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 px-5 py-4 space-y-4 min-h-[280px] max-h-[320px] overflow-y-auto">
        {DEMO_MESSAGES.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3 animate-slide-up",
              msg.role === "user" && "flex-row-reverse"
            )}
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            {msg.role === "assistant" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "rounded-xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed",
                msg.role === "assistant"
                  ? "bg-muted/50 text-foreground/90"
                  : "bg-primary/15 text-foreground ml-auto"
              )}
            >
              {msg.content}
              {"insight" in msg && msg.insight && (
                <div className="mt-3 flex items-center gap-3 rounded-lg bg-background/50 px-3 py-2 border border-border/50">
                  <msg.insight.icon className="h-4 w-4 text-accent" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{msg.insight.label}</p>
                    <p className="text-base font-bold text-accent">{msg.insight.value}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Suggested prompts */}
      <div className="px-5 pb-3 flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt, i) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setActivePrompt(i)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              activePrompt === i
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-5 pb-5">
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-4 py-2.5">
          <DumpTruckIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            id="copilot-preview-input"
            name="copilot-preview-input"
            type="text"
            placeholder="Ask anything about your fleet..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            readOnly
            aria-label="AI copilot input"
          />
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
