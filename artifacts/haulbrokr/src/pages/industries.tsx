import { HardHat, LayoutDashboard, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingLayout, MarketingPageHero } from "@/components/marketing/MarketingLayout";

const industries = [
  {
    icon: HardHat,
    title: "Construction & demolition",
    desc: "Contractors request trucks, compare activity, and keep jobsites moving with live dispatch and digital load records.",
  },
  {
    icon: Truck,
    title: "Dump truck operators",
    desc: "Owner-operators and small fleets find more loads, reduce idle time, and close jobs with proof-of-delivery workflows.",
  },
  {
    icon: LayoutDashboard,
    title: "Fleet management",
    desc: "Fleet owners manage trucks, drivers, compliance documents, revenue, and job history from one control dashboard.",
  },
];

export default function IndustriesPage() {
  return (
    <MarketingLayout>
      <MarketingPageHero
        eyebrow="Who we serve"
        title="For everyone moving material."
        description="HaulBrokr supports contractors, haulers, and fleet owners across construction, excavation, asphalt, and aggregate hauling."
      />
      <section className="py-20 sm:py-28">
        <div className="container mx-auto px-4">
          <div className="grid gap-5 md:grid-cols-3">
            {industries.map((item) => (
              <article key={item.title} className="industrial-panel rounded-3xl p-8 text-center">
                <div className="relative z-10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ff6a00] text-white neon-orange">
                  <item.icon className="h-8 w-8" aria-hidden="true" />
                </div>
                <h2 className="relative z-10 text-2xl font-black">{item.title}</h2>
                <p className="relative z-10 mt-2 text-white/60">{item.desc}</p>
              </article>
            ))}
          </div>
          <div className="mt-14 text-center">
            <Button asChild size="lg" className="neon-orange h-14 bg-[#ff6a00] px-8 text-base font-black text-white hover:bg-[#e85f00]">
              <a href="/sign-up">Join the Network</a>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
