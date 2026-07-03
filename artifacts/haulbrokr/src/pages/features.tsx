import {
  ClipboardCheck, DollarSign, LayoutDashboard, Navigation, ShieldCheck, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingLayout, MarketingPageHero } from "@/components/marketing/MarketingLayout";

const features = [
  { icon: Zap, title: "Fast dispatch", desc: "Replace phone calls and spreadsheets with one job board." },
  { icon: Navigation, title: "GPS visibility", desc: "See where trucks are and where work is moving." },
  { icon: ClipboardCheck, title: "Digital tickets", desc: "Keep load photos, timestamps, and signed proof organized." },
  { icon: ShieldCheck, title: "Verified network", desc: "Support approval workflows for haulers, fleets, and documents." },
  { icon: LayoutDashboard, title: "Control dashboard", desc: "Manage requests, bids, active hauls, billing, and reporting." },
  { icon: DollarSign, title: "Payment ready", desc: "Cleaner job records help contractors and vendors close faster." },
];

export default function FeaturesPage() {
  return (
    <MarketingLayout>
      <MarketingPageHero
        eyebrow="Platform capabilities"
        title="Built for heavy hauling workflows."
        description="HaulBrokr connects contractors, haulers, and fleet owners with dispatch, tracking, digital tickets, and payment-ready records."
      />
      <section className="py-20 sm:py-28">
        <div className="container mx-auto px-4">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article key={f.title} className="rounded-3xl border border-white/10 bg-black p-7 hover:border-[#ff6a00]/50">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff6a00]/12 text-[#ff6a00]">
                  <f.icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <h2 className="text-xl font-black">{f.title}</h2>
                <p className="mt-2 text-white/58">{f.desc}</p>
              </article>
            ))}
          </div>
          <div className="mt-14 text-center">
            <Button asChild size="lg" className="neon-orange h-14 bg-[#ff6a00] px-8 text-base font-black text-white hover:bg-[#e85f00]">
              <a href="/sign-up">Get Started</a>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
