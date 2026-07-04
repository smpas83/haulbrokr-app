import type { AutonomousLayerData } from "@/lib/operations-types";

interface ExecutiveDigestPanelProps {
  digest: AutonomousLayerData["executiveDigest"];
}

export function ExecutiveDigestPanel({ digest }: ExecutiveDigestPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">{digest.title}</p>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{digest.summary}</p>
      </div>
      {digest.highlights.length > 0 && (
        <ul className="space-y-1">
          {digest.highlights.map((h, i) => (
            <li key={i} className="text-xs flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {digest.risks.length > 0 && (
          <div>
            <p className="font-semibold uppercase tracking-wider text-destructive mb-1">Risks</p>
            {digest.risks.slice(0, 3).map((r, i) => <p key={i} className="text-muted-foreground">{r}</p>)}
          </div>
        )}
        {digest.opportunities.length > 0 && (
          <div>
            <p className="font-semibold uppercase tracking-wider text-emerald-400 mb-1">Opportunities</p>
            {digest.opportunities.slice(0, 3).map((o, i) => <p key={i} className="text-muted-foreground">{o}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
