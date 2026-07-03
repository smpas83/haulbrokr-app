import { MapPin, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingLayout, MarketingPageHero } from "@/components/marketing/MarketingLayout";

const values = [
  {
    icon: Truck,
    title: "Marketplace first",
    desc: "We connect contractors and haulers — HaulBrokr does not operate trucks or disposal facilities.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance built in",
    desc: "Document review, insurance verification, and payout readiness are part of the platform workflow.",
  },
  {
    icon: MapPin,
    title: "Built for the field",
    desc: "Dispatch, tracking placeholders, digital tickets, and mobile workflows support real jobsite operations.",
  },
];

export default function AboutPage() {
  return (
    <MarketingLayout>
      <MarketingPageHero
        eyebrow="About HaulBrokr"
        title="Industrial software for real hauling work."
        description="HaulBrokr is a technology marketplace connecting customers who need material moved with licensed dump truck operators and hauling companies across the United States."
      />
      <section className="py-20 sm:py-28">
        <div className="container mx-auto max-w-3xl px-4 space-y-10">
          <p className="text-lg leading-relaxed text-white/70">
            The platform supports job posting, bidding, award, in-progress tracking, proof capture, and payment-ready records. Staff admin tools help review compliance, credit applications, payouts, and marketplace health.
          </p>
          <div className="grid gap-5 sm:grid-cols-3">
            {values.map((item) => (
              <article key={item.title} className="rounded-3xl border border-white/10 bg-black p-6">
                <item.icon className="h-7 w-7 text-[#ff6a00]" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-black">{item.title}</h2>
                <p className="mt-2 text-sm text-white/58">{item.desc}</p>
              </article>
            ))}
          </div>
          <div className="text-center pt-4">
            <Button asChild size="lg" className="neon-orange h-14 bg-[#ff6a00] px-8 text-base font-black text-white hover:bg-[#e85f00]">
              <a href="/sign-up">Get Started</a>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
