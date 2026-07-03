import { MarketingLayout, MarketingPageHero } from "@/components/marketing/MarketingLayout";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By using HaulBrokr, you agree to these Terms of Service. HaulBrokr LLC may update these Terms at any time. Continued use after changes constitutes acceptance.",
  },
  {
    title: "2. Description of Service",
    body: "HaulBrokr is a technology marketplace connecting customers who need hauling with licensed dump truck operators and hauling companies. HaulBrokr does not perform hauling services and does not own or operate trucks or disposal facilities.",
  },
  {
    title: "3. User Eligibility",
    body: "Users must be at least 18, provide accurate registration information, and maintain account security. Providers must maintain required licenses, permits, and insurance.",
  },
  {
    title: "4. Bidding & Job Awards",
    body: "Providers submit bids through the platform. Customers retain discretion to accept or reject bids. Accepted bids create a binding service agreement between customer and provider.",
  },
  {
    title: "5. Payments & Fees",
    body: "Customers are billed through Stripe when jobs complete. Providers receive payouts through Stripe Connect minus applicable platform fees. Net-terms and credit applications are subject to staff approval.",
  },
  {
    title: "6. Compliance & Documents",
    body: "Providers must maintain valid insurance, operating authority, and required compliance documents. HaulBrokr may review, approve, or reject documents and suspend accounts for non-compliance.",
  },
  {
    title: "7. Limitation of Liability",
    body: "HaulBrokr is a marketplace intermediary. The company is not liable for hauling performance, disposal compliance, or disputes between customers and providers except as required by law.",
  },
  {
    title: "8. Contact",
    body: "Questions about these Terms may be directed to info@haulbrokr.com.",
  },
];

export default function TermsPage() {
  return (
    <MarketingLayout>
      <MarketingPageHero
        eyebrow="Legal"
        title="Terms of Service"
        description="Effective June 17, 2026. These terms govern use of the HaulBrokr web and mobile applications."
      />
      <section className="py-16 sm:py-24">
        <div className="container mx-auto max-w-3xl px-4 space-y-10">
          {SECTIONS.map((section) => (
            <article key={section.title}>
              <h2 className="text-xl font-black">{section.title}</h2>
              <p className="mt-3 leading-relaxed text-white/70">{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
