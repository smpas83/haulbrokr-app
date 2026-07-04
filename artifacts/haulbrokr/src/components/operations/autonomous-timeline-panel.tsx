import { useState } from "react";
import { format } from "date-fns";
import { Search, Clock } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import type { AutonomousLayerData } from "@/lib/operations-types";

interface AutonomousTimelinePanelProps {
  initialEvents: AutonomousLayerData["autonomousActivity"];
}

export function AutonomousTimelinePanel({ initialEvents }: AutonomousTimelinePanelProps) {
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState(initialEvents);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    setSearching(true);
    try {
      const data = await apiFetch<{ events: typeof events }>(`/autonomous/timeline?q=${encodeURIComponent(query)}`);
      setEvents(data.events);
    } catch {
      setEvents(initialEvents);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search timeline…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <Button size="sm" variant="outline" onClick={search} disabled={searching}>Search</Button>
      </div>
      <div className="space-y-1 max-h-[320px] overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No timeline events</p>
        ) : events.map((e) => (
          <div key={e.id} className="flex items-start gap-3 py-2.5 px-3 rounded-lg border-b border-border/30 last:border-0">
            <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{e.title}</p>
              <p className="text-xs text-muted-foreground truncate">{e.description}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {e.eventType.replace(/_/g, " ")} · {format(new Date(e.createdAt), "MMM d, h:mm a")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
