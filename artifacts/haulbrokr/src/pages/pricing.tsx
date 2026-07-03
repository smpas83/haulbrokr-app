import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingLayout, MarketingPageHero } from "@/components/marketing/MarketingLayout";

const tiers = [
  {
    name: "Customers",
    subtitle: "Contractors & jobsites",
    price: "Pay per haul",
    bullets: [
      "Post haul requests and compare bids",
      "Track active jobs and documents",
      "Stripe billing when jobs complete",
      "Net-terms available on approval",
    ],
  },
  {
    name: "Providers",
    subtitle: "Haulers & fleet owners",
    price: "15% platform fee",
    highlight: true,
    bullets: [
      "Browse open loads and submit bids",
      "Fleet, driver, and compliance tools",
      "Stripe Connect payouts",
      "Digital tickets and proof of delivery",
    ],
  },
  {
    name: "Enterprise",
    subtitle: "Multi-site operations",
    price: "Contact us",
    bullets: [
      "Volume dispatch across projects",
      "Staff admin and compliance review",
      "Reporting and export tools",
      "Dedicated onboarding support",
    ],
  },
];

export default function PricingPage() {
  return (
    <MarketingLayout>
      <MarketingPageHero
        eyebrow="Transparent marketplace pricing"
        title="Simple economics for hauling work."
        description="Customers pay for completed hauls. Providers earn net payouts after the platform broker fee. Enterprise teams can contact us for tailored onboarding."
      />
      <section className="py-20 sm:py-28">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {tiers.map((tier) => (
              <article
                key={tier.name}
                className={`rounded-3xl border p-8 ${
                  tier.highlight
                    ? "border-[#ff6a00]/60 bg-[#ff6a00]/5"
                    : "border-white/10 bg-black"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#ff6a00]">{tier.subtitle}</p>
                <h2 className="mt-2 text-3xl font-black">{tier.name}</h2>
                <p className="mt-4 text-2xl font-black text-[#ff6a00]">{tier.price}</p>
                <ul className="mt-8 space-y-3">
                  {tier.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-sm text-white/70">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6a00]" aria-hidden="true" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-white/45">
            {/* PLACEHOLDER: Final pricing table visuals — awaiting ChatGPT visual package */}
            Detailed rate cards, volume tiers, and comparison tables will be supplied in the final design package.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="neon-orange h-14 bg-[#ff6a00] px-8 text-base font-black text-white hover:bg-[#e85f00]">
              <a href="/sign-up">Create account</a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 border-2 border-white/25 bg-black/40 px-8 text-base font-black text-white hover:border-[#ff6a00] hover:bg-[#ff6a00]/10">
              <a href="/contact">Contact sales</a>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
