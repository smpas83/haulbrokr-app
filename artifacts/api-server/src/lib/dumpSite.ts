import type { dumpSitesTable } from "@workspace/db";

type DumpSiteRecord = typeof dumpSitesTable.$inferSelect;

function nullableNumber(value: string | null | undefined): number | null {
  return value == null ? null : parseFloat(value);
}

export function serializeDumpSite(site: DumpSiteRecord) {
  return {
    id: site.id,
    name: site.name,
    address: site.address,
    city: site.city,
    state: site.state,
    zip: site.zip,
    type: site.type,
    phone: site.phone,
    latitude: nullableNumber(site.latitude),
    longitude: nullableNumber(site.longitude),
    hours: site.hours,
    acceptedMaterials: Array.isArray(site.acceptedMaterials) ? site.acceptedMaterials : [],
    tippingFeeDetails: site.tippingFeeDetails,
    paymentMethods: site.paymentMethods,
    instructions: site.instructions,
    isActive: site.isActive,
    fullAddress: `${site.name}, ${site.address}, ${site.city}, ${site.state} ${site.zip}`,
  };
}
