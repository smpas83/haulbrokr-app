import { useQuery } from "@tanstack/react-query";
import type { Job } from "@workspace/api-client-react";

import { apiFetch } from "@/lib/apiFetch";

type TicketRow = { driverProfileId: number };

export function useDriverAssignedJobIds(jobs: Job[] | undefined, driverProfileId: number | undefined) {
  return useQuery({
    queryKey: ["driver-assigned-jobs", driverProfileId, jobs?.map((j) => j.id).join(",")],
    queryFn: async () => {
      const ids = new Set<number>();
      if (!jobs?.length || !driverProfileId) return ids;

      await Promise.all(
        jobs.map(async (job) => {
          try {
            const data = await apiFetch<{ tickets: TicketRow[] }>(`/jobs/${job.id}/tickets`);
            if (data.tickets?.some((t) => t.driverProfileId === driverProfileId)) {
              ids.add(job.id);
            }
          } catch {
            // Skip jobs we cannot read tickets for.
          }
        }),
      );
      return ids;
    },
    enabled: !!driverProfileId && !!jobs?.length,
    staleTime: 30_000,
  });
}
