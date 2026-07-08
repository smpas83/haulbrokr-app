import { Truck, Users, MapPin, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const values = [
  {
    icon: MapPin,
    title: "Built for construction",
    description:
      "Purpose-built for dirt, aggregate, and material hauling — not generic freight.",
  },
  {
    icon: Users,
    title: "Two-sided marketplace",
    description:
      "Customers post loads; verified providers bid, dispatch, and get paid through one platform.",
  },
  {
    icon: Shield,
    title: "Compliance first",
    description:
      "DOT, insurance, and payout verification built into onboarding and job workflows.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <a href="/">
            <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight cursor-pointer">
              <Truck className="h-6 w-6" />
              HaulBrokr
            </div>
          </a>
          <Button asChild className="font-semibold">
            <a href="/sign-up">Get Started</a>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-16 md:py-24 px-4 bg-card border-b border-border">
          <div className="container mx-auto max-w-5xl">
            <p className="font-mono text-sm uppercase tracking-widest text-primary mb-4">
              About
            </p>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-foreground leading-[1.1]">
              The construction hauling marketplace
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
              HaulBrokr connects construction sites and project managers with
              verified hauling fleets. Post loads, receive bids, track jobs in
              real time, and pay out providers — all in one mission control
              dashboard.
            </p>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="container mx-auto max-w-5xl grid md:grid-cols-3 gap-8">
            {values.map((item) => (
              <div
                key={item.title}
                className="border border-border/60 bg-card p-8 space-y-4"
              >
                <item.icon className="h-8 w-8 text-primary" />
                <h2 className="text-xl font-bold">{item.title}</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 px-4 bg-card border-t border-border">
          <div className="container mx-auto max-w-5xl text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to haul smarter?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join customers and fleet owners already using HaulBrokr to move
              material faster.
            </p>
            <Button asChild size="lg" className="font-bold">
              <a href="/sign-up">
                Create free account
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-card border-t border-border py-12 px-4 text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-6 mb-4 text-sm font-semibold">
          <a href="/" className="hover:text-primary">
            Home
          </a>
          <a href="/terms" className="hover:text-primary">
            Terms
          </a>
          <a href="/privacy" className="hover:text-primary">
            Privacy
          </a>
          <a href="/contact" className="hover:text-primary">
            Contact
          </a>
        </div>
        <p>
          © {new Date().getFullYear()} HaulBrokr Logistics. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
