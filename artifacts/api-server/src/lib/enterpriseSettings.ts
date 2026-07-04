import { db, enterpriseSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logEnterpriseAudit } from "./enterpriseAudit";

export interface EnterpriseSettingsPayload {
  companyProfile: { regions: string[]; branding: string };
  pricing: { defaultRatePerHour: number; platformFeeRate: number };
  equipmentTypes: string[];
  materialTypes: string[];
  notifications: { email: boolean; push: boolean; smartOnly: boolean };
  automation: { autoApproveLowRisk: boolean; aiCopilotEnabled: boolean };
  aiPreferences: { insightLevel: string; autoExecute: boolean };
}

const DEFAULT_SETTINGS: EnterpriseSettingsPayload = {
  companyProfile: { regions: [], branding: "default" },
  pricing: { defaultRatePerHour: 120, platformFeeRate: 0.15 },
  equipmentTypes: ["dump_truck", "super_10", "end_dump", "bottom_dump"],
  materialTypes: ["dirt", "gravel", "sand", "concrete", "asphalt", "demolition"],
  notifications: { email: true, push: true, smartOnly: true },
  automation: { autoApproveLowRisk: false, aiCopilotEnabled: true },
  aiPreferences: { insightLevel: "balanced", autoExecute: false },
};

export async function getSettings(orgId: number | null, profileId: number): Promise<EnterpriseSettingsPayload> {
  if (!orgId) return DEFAULT_SETTINGS;

  const [row] = await db.select()
    .from(enterpriseSettingsTable)
    .where(eq(enterpriseSettingsTable.organizationId, orgId))
    .limit(1);

  if (!row) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.settings) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(
  orgId: number | null,
  profileId: number,
  patch: Partial<EnterpriseSettingsPayload>,
) {
  const current = await getSettings(orgId, profileId);
  const merged = { ...current, ...patch };

  if (orgId) {
    const [existing] = await db.select().from(enterpriseSettingsTable).where(eq(enterpriseSettingsTable.organizationId, orgId));
    if (existing) {
      await db.update(enterpriseSettingsTable)
        .set({ settings: JSON.stringify(merged), updatedAt: new Date() })
        .where(eq(enterpriseSettingsTable.organizationId, orgId));
    } else {
      await db.insert(enterpriseSettingsTable).values({
        organizationId: orgId,
        profileId,
        settings: JSON.stringify(merged),
      });
    }
  }

  await logEnterpriseAudit({
    organizationId: orgId,
    actorProfileId: profileId,
    action: "settings.update",
    resourceType: "settings",
    details: patch as Record<string, unknown>,
  });

  return merged;
}
