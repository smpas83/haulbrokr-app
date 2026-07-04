import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, X, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import { CHART_COLORS } from "@/lib/design-tokens";
import { InsightCard } from "@/components/operations/insight-card";
import type { OperationInsight } from "@/lib/operations-types";

interface Message {
  role: "user" | "assistant";
  content: string;
  chart?: { type: string; data: { label: string; value: number; count?: number }[] };
}

interface CopilotInsights {
  suggestions: string[];
  summary: {
    openLoads: number;
    activeJobs: number;
    trucksAvailable: number;
    todayRevenue?: number;
    fleetUtilization?: number;
    morningBrief?: string;
    contextSummary?: string;
  };
  insights?: OperationInsight[];
  recentActivity?: { description: string; createdAt: string }[];
  analytics?: {
    revenueForecast7d: number;
    fleetUtilization: number;
    weeklyEvents: { label: string; count: number }[];
  };
}

interface CopilotPanelProps {
  open: boolean;
  onClose: () => void;
}

export function CopilotPanel({ open, onClose }: CopilotPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [insights, setInsights] = useState<OperationInsight[]>([]);
  const [summary, setSummary] = useState<CopilotInsights["summary"] | null>(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    apiFetch<CopilotInsights>("/copilot/insights")
      .then((data) => {
        setSuggestions(data.suggestions ?? []);
        setInsights(data.insights ?? []);
        setSummary(data.summary ?? null);
      })
      .catch(() => setSuggestions(["Summarize my active jobs", "Show open loads"]));
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setLoading(true);
    try {
      const res = await apiFetch<{ content: string; chart?: Message["chart"] }>("/copilot/chat", {
        method: "POST",
        body: JSON.stringify({ message: trimmed }),
      });
      setMessages((m) => [...m, { role: "assistant", content: res.content, chart: res.chart }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: err instanceof Error ? err.message : "Something went wrong." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md h-full surface-panel-elevated border-l border-border/60 flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">HaulBrokr AI Copilot</p>
              <p className="text-xs text-emerald-400 flex items-center gap-1"><Sparkles className="h-3 w-3" />Context-aware</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close copilot">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {summary && messages.length === 0 && (
          <div className="px-5 py-3 border-b border-border/50 space-y-2">
            {summary.morningBrief && (
              <p className="text-xs text-muted-foreground leading-relaxed">{summary.morningBrief}</p>
            )}
            {summary.contextSummary && (
              <div className="flex items-center gap-2 text-xs">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">{summary.contextSummary}</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/30 py-2">
                <p className="text-lg font-bold stat-number">{summary.activeJobs}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Active</p>
              </div>
              <div className="rounded-lg bg-muted/30 py-2">
                <p className="text-lg font-bold stat-number">{summary.openLoads}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Open</p>
              </div>
              <div className="rounded-lg bg-muted/30 py-2">
                <p className="text-lg font-bold stat-number">{summary.fleetUtilization ?? summary.trucksAvailable}%</p>
                <p className="text-[10px] text-muted-foreground uppercase">{summary.fleetUtilization != null ? "Util." : "Trucks"}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && insights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Insights</p>
              {insights.slice(0, 2).map((insight) => (
                <InsightCard key={insight.id} insight={insight} compact />
              ))}
            </div>
          )}
          {messages.length === 0 && insights.length === 0 && (
            <p className="text-sm text-muted-foreground">Ask about open loads, active jobs, fleet utilization, revenue forecasts, or dispatch steps.</p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex flex-col gap-2", msg.role === "user" && "items-end")}>
              <div className={cn(
                "rounded-xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap",
                msg.role === "assistant" ? "bg-muted/50" : "bg-primary/15"
              )}>
                {msg.content}
              </div>
              {msg.chart && msg.chart.data.length > 0 && (
                <div className="w-full max-w-[85%] rounded-xl border border-border/50 p-3 bg-muted/20">
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={msg.chart.data.map((d) => ({ name: d.label, value: d.value ?? d.count ?? 0 }))}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip />
                      <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ))}
          {loading && <p className="text-xs text-muted-foreground animate-pulse">Analyzing your operations…</p>}
          <div ref={bottomRef} />
        </div>

        {suggestions.length > 0 && messages.length === 0 && (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="px-5 pb-5 border-t border-border/50 pt-4">
          <form
            className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-4 py-2.5"
            onSubmit={(e) => { e.preventDefault(); send(input); }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your fleet…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Copilot message"
            />
            <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
