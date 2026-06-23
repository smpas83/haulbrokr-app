export type OnboardingRole = "customer" | "provider" | "driver";

export type OnboardingFormValues = {
  role: OnboardingRole;
  companyName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  inviteCode?: string;
  dba?: string;
  website?: string;
  mcNumber?: string;
  capacityTons?: string;
  capacityYards?: string;
  countiesServed?: string;
  hourlyRate?: string;
  minimumHours?: string;
  equipmentTypes?: string[];
  billingEinLast4?: string;
  apContactName?: string;
  apEmail?: string;
  paymentTerms?: "due_on_receipt" | "net_15" | "net_30" | "prepaid";
};

const num = (v?: string) => (v && v.trim() !== "" ? Number(v) : undefined);
const str = (v?: string) => (v && v.trim() !== "" ? v.trim() : undefined);

/** Maps onboarding form values to POST /profiles body (mirrors web onboarding submit). */
export function buildCreateProfilePayload(values: OnboardingFormValues): Record<string, unknown> {
  if (values.role === "driver") {
    return {
      role: "driver",
      companyName: "Pending team assignment",
      contactName: str(values.contactName),
      phone: str(values.phone),
      inviteCode: values.inviteCode?.trim().toUpperCase(),
    };
  }

  const base: Record<string, unknown> = {
    role: values.role,
    companyName: values.companyName,
    contactName: str(values.contactName),
    phone: str(values.phone),
    email: str(values.email),
    address: str(values.address),
    city: str(values.city),
    state: str(values.state),
    zip: str(values.zip),
  };

  if (values.role === "provider") {
    Object.assign(base, {
      dba: str(values.dba),
      website: str(values.website),
      mcNumber: str(values.mcNumber),
      capacityTons: num(values.capacityTons),
      capacityYards: num(values.capacityYards),
      countiesServed: str(values.countiesServed),
      hourlyRate: num(values.hourlyRate),
      minimumHours: num(values.minimumHours),
      equipmentTypes: values.equipmentTypes?.length ? values.equipmentTypes.join(",") : undefined,
    });
  } else {
    Object.assign(base, {
      billingEinLast4: str(values.billingEinLast4),
      apContactName: str(values.apContactName),
      apEmail: str(values.apEmail),
      paymentTerms: values.paymentTerms,
    });
  }

  return base;
}
