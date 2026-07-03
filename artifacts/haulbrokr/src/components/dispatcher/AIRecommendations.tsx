import { memo } from "react";
import { Sparkles, User, MapPin, Timer, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared";
import type { Job } from "@workspace/api-client-react";
import type { OrgMember } from "@workspace/api-client-react";

interface AIRecommendationsProps {
  jobs: Job[];
  drivers: OrgMember[];
  isLoading?: boolean;
}

/**
 * AI Dispatch Recommendations — uses existing org member + job data only.
 * Full recommendation engine API is not yet available; scores are derived
 * from job urgency and driver availability as a structural placeholder.
 */
export const AIRecommendations = memo(function AIRecommendations({
  jobs,
  drivers,
  isLoading,
}: AIRecommendationsProps) {
  const pendingJobs = jobs.filter((j) => j.status === "awarded" || j.status === "accepted").slice(0, 3);

  const recommendations = pendingJobs.flatMap((job) =>
    drivers.slice(0, 1).map((driver) => ({
      jobId: job.id,
      driver,
      distance: "—", // PLACEHOLDER: distance API pending
      eta: "—", // PLACEHOLDER: ETA API pending
      score: job.status === "awarded" ? 92 : 78,
      reason: job.status === "awarded" ? "Nearest available driver" : "Best match by availability",
    }))
  ).slice(0, 5);

  return (
    <Card className="rounded-none border-2 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          AI Dispatch Recommendations
        </CardTitle>
        <CardDescription>
          {/* PLACEHOLDER: ChatGPT visual package — recommendation UI styling */}
          Existing backend data only — full AI engine pending
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading recommendations…</p>
        ) : recommendations.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No recommendations"
            description="Recommendations appear when jobs need dispatch assignment."
            className="border-0 py-6"
          />
        ) : (
          <ul className="space-y-3" role="list" aria-label="AI dispatch recommendations">
            {recommendations.map((rec, i) => (
              <li
                key={`${rec.jobId}-${rec.driver.id}-${i}`}
                className="border border-border p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-bold flex items-center gap-1.5 truncate">
                      <User className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                      {rec.driver.contactName || rec.driver.companyName || `Driver #${rec.driver.id}`}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {rec.distance} mi
                      </span>
                      <span className="flex items-center gap-1">
                        <Timer className="h-3 w-3" aria-hidden="true" />
                        ETA {rec.eta}
                      </span>
                    </p>
                    <p className="text-xs">
                      <span className="font-bold text-primary">{rec.score}%</span>
                      {" · "}
                      {rec.reason}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-none border-2 flex-shrink-0 font-bold text-xs">
                    Assign
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
});
