import { and, eq, or } from "drizzle-orm";
import {
  db,
  dispatchDecisionsTable,
  profilesTable,
  trucksTable,
  type Job,
  type Profile,
  type Truck,
} from "@workspace/db";

export type DispatchRecommendation = {
  driverProfileId: number;
  truckId: number | null;
  score: number;
  reason: string;
};

function scorePair(
  job: Pick<Job, "truckType">,
  driver: Profile,
  truck: Truck | null,
): DispatchRecommendation {
  let score = 50;
  const reasons: string[] = [];

  if (driver.role === "driver") {
    score += 15;
    reasons.push("assigned company driver");
  } else {
    reasons.push("provider owner fallback");
  }

  if (truck) {
    score += 10;
    reasons.push("available fleet truck");
    if (truck.truckType === job.truckType) {
      score += 25;
      reasons.push(`${job.truckType.replace(/_/g, " ")} match`);
    }
    if (truck.assignedDriverId === driver.id) {
      score += 10;
      reasons.push("driver already assigned to truck");
    }
  } else {
    reasons.push("no available truck selected");
  }

  return {
    driverProfileId: driver.id,
    truckId: truck?.id ?? null,
    score,
    reason: reasons.join("; "),
  };
}

export async function recommendDispatchForJob(
  job: Job,
): Promise<DispatchRecommendation[]> {
  const [provider] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, job.providerId));
  const drivers = provider?.organizationId
    ? await db
        .select()
        .from(profilesTable)
        .where(
          and(
            eq(profilesTable.organizationId, provider.organizationId),
            or(
              eq(profilesTable.role, "driver"),
              eq(profilesTable.id, job.providerId),
            )!,
          ),
        )
    : provider
      ? [provider]
      : [];

  const trucks = await db
    .select()
    .from(trucksTable)
    .where(
      and(
        eq(trucksTable.ownerId, job.providerId),
        eq(trucksTable.isAvailable, true),
      ),
    );

  const pairs: DispatchRecommendation[] = [];
  for (const driver of drivers) {
    const assignedTruck =
      trucks.find((truck) => truck.assignedDriverId === driver.id) ?? null;
    const typeMatch =
      trucks.find(
        (truck) =>
          truck.truckType === job.truckType &&
          (truck.assignedDriverId == null ||
            truck.assignedDriverId === driver.id),
      ) ?? null;
    const fallback =
      trucks.find((truck) => truck.assignedDriverId == null) ?? null;
    pairs.push(scorePair(job, driver, assignedTruck ?? typeMatch ?? fallback));
  }

  return pairs.sort((a, b) => b.score - a.score).slice(0, 5);
}

export async function recordDispatchDecision(input: {
  job: Job;
  selectedByProfileId: number;
  driverProfileId: number;
  truckId?: number | null;
}): Promise<typeof dispatchDecisionsTable.$inferSelect | null> {
  const recommendations = await recommendDispatchForJob(input.job);
  const selected = recommendations.find(
    (item) =>
      item.driverProfileId === input.driverProfileId &&
      (input.truckId == null || item.truckId === input.truckId),
  ) ?? {
    driverProfileId: input.driverProfileId,
    truckId: input.truckId ?? null,
    score: 0,
    reason: "Manual dispatcher override",
  };

  const [decision] = await db
    .insert(dispatchDecisionsTable)
    .values({
      jobId: input.job.id,
      requestId: input.job.requestId,
      providerId: input.job.providerId,
      driverProfileId: input.driverProfileId,
      truckId: input.truckId ?? null,
      status: selected.score > 0 ? "assigned" : "overridden",
      score: String(selected.score),
      reason: selected.reason,
      recommendation: { selected, recommendations },
      selectedByProfileId: input.selectedByProfileId,
    })
    .returning();
  return decision ?? null;
}
