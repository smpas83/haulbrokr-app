import {
  db, jobsTable, requestsTable, trucksTable,
  enterpriseReportsTable,
} from "@workspace/db";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { searchDocuments } from "./documentCenter";
import { searchTimeline } from "./autonomousMemory";
import { searchOperations } from "./operationsInsights";

interface ProfileCtx {
  id: number;
  role: string;
  companyName: string;
  state: string | null;
}

export interface GlobalSearchResult {
  type: string;
  label: string;
  href: string;
  subtitle?: string;
  category: string;
}

export async function globalSearch(profile: ProfileCtx, query: string): Promise<GlobalSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const results: GlobalSearchResult[] = [];
  const pattern = `%${q}%`;
  const idMatch = q.match(/#?(\d+)/);
  const numId = idMatch ? parseInt(idMatch[1]!, 10) : NaN;

  const [opsResults] = await Promise.all([
    searchOperations(profile, q),
  ]);
  for (const r of opsResults.results) {
    results.push({ ...r, category: "Navigation" });
  }

  if (Number.isFinite(numId)) {
    const jobScope = profile.role === "customer"
      ? eq(jobsTable.customerId, profile.id)
      : profile.role === "provider"
        ? eq(jobsTable.providerId, profile.id)
        : sql`1=1`;

    const [job] = await db.select({ id: jobsTable.id, materialType: jobsTable.materialType })
      .from(jobsTable).where(and(eq(jobsTable.id, numId), jobScope));
    if (job) results.push({ type: "load", label: `Job #${job.id}`, href: `/jobs/${job.id}`, subtitle: job.materialType, category: "Loads" });
  }

  const jobs = await db.select({ id: jobsTable.id, materialType: jobsTable.materialType, pickupAddress: jobsTable.pickupAddress })
    .from(jobsTable)
    .where(and(
      profile.role === "customer" ? eq(jobsTable.customerId, profile.id) : eq(jobsTable.providerId, profile.id),
      or(ilike(jobsTable.materialType, pattern), ilike(jobsTable.pickupAddress, pattern)),
    ))
    .limit(5);
  for (const j of jobs) {
    if (!results.some((r) => r.href === `/jobs/${j.id}`)) {
      results.push({ type: "load", label: `Job #${j.id}`, href: `/jobs/${j.id}`, subtitle: j.pickupAddress, category: "Loads" });
    }
  }

  const reqs = await db.select({ id: requestsTable.id, materialType: requestsTable.materialType })
    .from(requestsTable)
    .where(and(
      profile.role === "customer" ? eq(requestsTable.customerId, profile.id) : sql`1=1`,
      or(ilike(requestsTable.materialType, pattern), ilike(requestsTable.pickupAddress, pattern)),
    ))
    .limit(5);
  for (const r of reqs) {
    results.push({ type: "request", label: `Request #${r.id}`, href: `/requests/${r.id}`, subtitle: r.materialType, category: "Loads" });
  }

  if (profile.role === "provider") {
    const trucks = await db.select({ id: trucksTable.id, truckNumber: trucksTable.truckNumber, truckType: trucksTable.truckType })
      .from(trucksTable)
      .where(and(eq(trucksTable.ownerId, profile.id), or(ilike(trucksTable.truckNumber, pattern), ilike(trucksTable.truckType, pattern))))
      .limit(5);
    for (const t of trucks) {
      results.push({ type: "equipment", label: t.truckNumber ?? `Truck #${t.id}`, href: "/fleet", subtitle: t.truckType, category: "Equipment" });
    }
  }

  const docs = await searchDocuments(profile.id, q);
  for (const d of docs.slice(0, 5)) {
    results.push({ type: "document", label: d.title, href: d.href ?? "/enterprise", subtitle: d.category, category: "Documents" });
  }

  const aiHistory = await searchTimeline(profile.id, q, 5);
  for (const e of aiHistory) {
    results.push({ type: "ai", label: e.title, href: "/dashboard", subtitle: e.eventType, category: "AI History" });
  }

  const reports = await db.select({ id: enterpriseReportsTable.id, name: enterpriseReportsTable.name })
    .from(enterpriseReportsTable)
    .where(and(eq(enterpriseReportsTable.profileId, profile.id), ilike(enterpriseReportsTable.name, pattern)))
    .limit(5);
  for (const r of reports) {
    results.push({ type: "report", label: r.name, href: "/enterprise?tab=reports", category: "Reports" });
  }

  results.push({ type: "nav", label: "Enterprise Hub", href: "/enterprise", subtitle: "Workflows, tasks, finance", category: "Navigation" });

  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.type}-${r.href}-${r.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 25);
}
