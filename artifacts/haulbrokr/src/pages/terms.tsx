import { FileText, Scale, ShieldCheck, Truck } from "lucide-react";
import { PublicPageLayout } from "@/components/public-page-layout";

const EFFECTIVE_DATE = "June 17, 2026";

const sections = [
  {
    icon: Truck,
    title: "Marketplace use",
    body: "HaulBrokr helps customers and providers coordinate hauling work. Users are responsible for accurate job, company, fleet, and payment information.",
  },
  {
    icon: ShieldCheck,
    title: "Account responsibility",
    body: "Keep account credentials secure and contact us promptly if you believe your account or company access is incorrect.",
  },
  {
    icon: FileText,
    title: "Job records",
    body: "Photos, tickets, timestamps, bids, and payment records entered into HaulBrokr may be used to support job administration, billing, and dispute review.",
  },
  {
    icon: Scale,
    title: "Service availability",
    body: "We work to keep public information and authenticated workflows available, but some private services may be unavailable during maintenance or configuration changes.",
  },
];

export default function TermsPage() {
  return (
    <PublicPageLayout
      eyebrow="Terms of Service"
      title={<>Clear rules for <span className="text-primary">moving work.</span></>}
      description="These terms summarize how HaulBrokr users should access the marketplace, manage account information, and use job records."
    >
      <section className="py-16 px-4 bg-background border-b border-border">
        <div className="container mx-auto max-w-5xl">
          <p className="font-mono text-sm text-muted-foreground">Effective {EFFECTIVE_DATE}</p>
        </div>
      </section>

      <section className="py-16 md:py-20 px-4 bg-background">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-px bg-border border-2 border-border">
            {sections.map((section) => (
              <div key={section.title} className="bg-card p-8 space-y-4">
                <div className="h-12 w-12 bg-primary/10 flex items-center justify-center text-primary">
                  <section.icon className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold">{section.title}</h2>
                <p className="text-muted-foreground leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
}
