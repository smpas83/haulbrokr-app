import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Bot,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  Globe2,
  HardHat,
  Map,
  MapPin,
  MessageSquareText,
  Navigation,
  RadioTower,
  Search,
  ShieldCheck,
  Smartphone,
  Star,
  TicketCheck,
  Truck,
  UserCheck,
  WalletCards,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

const navItems = [
  { label: "Marketplace", href: "#marketplace" },
  { label: "Coverage", href: "#coverage" },
  { label: "Features", href: "#features" },
  { label: "Industries", href: "#industries" },
  { label: "Trust", href: "#trust" },
];

const features = [
  { icon: Zap, title: "Instant Dispatch", desc: "Post urgent demand and route matching trucks without the phone tree." },
  { icon: Navigation, title: "Live GPS Tracking", desc: "Track active hauls, ETAs, driver movement, and site arrival status." },
  { icon: TicketCheck, title: "Digital Load Tickets", desc: "Capture proof, weights, photos, timestamps, and completion records." },
  { icon: Truck, title: "Fleet Management", desc: "Organize trucks, drivers, assignments, compliance, and availability." },
  { icon: UserCheck, title: "Verified Drivers", desc: "Support driver verification, DOT details, documents, and readiness." },
  { icon: BadgeCheck, title: "Verified Contractors", desc: "Give haulers confidence in customer identity and payment workflows." },
  { icon: WalletCards, title: "Real-Time Pricing", desc: "Keep rates, bids, invoices, and job value visible in one place." },
  { icon: Bot, title: "AI Dispatch Assistance", desc: "Surface next-best dispatch actions while operators stay in control." },
  { icon: Star, title: "Driver Ratings", desc: "Preserve service quality with driver reputation signals after delivery." },
  { icon: Star, title: "Customer Ratings", desc: "Help fleets choose reliable contractors and repeatable work." },
  { icon: CreditCard, title: "Stripe Secure Payments", desc: "Connect payment-ready job records to secure checkout and payouts." },
  { icon: Bell, title: "Notifications", desc: "Keep teams aligned around bid, dispatch, ticket, and payment activity." },
  { icon: MessageSquareText, title: "SMS Updates", desc: "Reach the field with job updates on the channels crews already use." },
  { icon: Smartphone, title: "Push Notifications", desc: "Alert drivers and dispatchers when loads, routes, or status change." },
  { icon: FileCheck2, title: "Document Management", desc: "Centralize W-9s, COIs, tickets, evidence, and compliance documents." },
];

const industries = [
  "Construction",
  "Rock Quarry",
  "Aggregate",
  "Asphalt",
  "Ready Mix",
  "Mining",
  "Utilities",
  "Heavy Civil",
  "Demolition",
  "Agriculture",
  "Commercial",
  "Municipal",
];

const marketplaceMetrics = [
  { value: 10000, suffix: "+", label: "Registered Trucks" },
  { value: 5000, suffix: "+", label: "Drivers" },
  { value: 12000, suffix: "+", label: "Loads Coordinated" },
  { value: 50, suffix: "", label: "States" },
  { value: 42, prefix: "$", suffix: "M+", label: "Paid Through Jobs" },
  { value: 24, suffix: "/7", label: "Live Jobs" },
];

const contractorSteps = ["Post Job", "Receive Quotes", "Track Driver", "Receive Invoice", "Rate Driver"];
const driverSteps = ["Sign Up", "Verify", "Accept Load", "Navigate", "Deliver", "Upload Ticket", "Get Paid"];

const trustItems = [
  { icon: BadgeCheck, title: "Verified Vendors" },
  { icon: ShieldCheck, title: "DOT Compliant" },
  { icon: FileCheck2, title: "Insurance Tracking" },
  { icon: CreditCard, title: "Secure Payments" },
  { icon: RadioTower, title: "Live Tracking" },
  { icon: Globe2, title: "Nationwide Coverage" },
  { icon: Star, title: "5-Star Ratings" },
];

const mapMarkers = [
  { label: "Truck HB-214", meta: "ETA 09 min", className: "left-[16%] top-[30%]" },
  { label: "Quarry Load", meta: "12 trucks", className: "left-[38%] top-[46%]" },
  { label: "Dispatcher", meta: "Active", className: "left-[58%] top-[28%]" },
  { label: "Customer Job", meta: "Bid live", className: "left-[74%] top-[58%]" },
  { label: "Route ETA", meta: "23 min", className: "left-[24%] top-[68%]" },
];

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(media.matches);

    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

function AnimatedMetric({
  value,
  label,
  prefix = "",
  suffix = "",
}: {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    let animationFrame = 0;
    const totalFrames = 54;

    const tick = () => {
      frame += 1;
      const progress = 1 - Math.pow(1 - frame / totalFrames, 3);
      setDisplayValue(Math.round(value * Math.min(progress, 1)));

      if (frame < totalFrames) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [prefersReducedMotion, value]);

  return (
    <Card className="homepage-card rounded-none">
      <CardContent className="p-5 sm:p-6">
        <p className="font-mono text-3xl font-black tracking-tight text-primary sm:text-4xl">
          {prefix}
          {displayValue.toLocaleString()}
          {suffix}
        </p>
        <p className="mt-2 text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export default function LandingPage() {
  return (
    <div className="homepage-shell min-h-screen overflow-hidden text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      <header className="sticky top-0 z-50 border-b border-primary/20 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1680px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <a href="/" aria-label="HaulBrokr home" className="shrink-0">
            <img src="/haulbrokr-logo.png" alt="HaulBrokr" className="h-9 w-auto sm:h-11" width="1024" height="576" />
          </a>
          <nav aria-label="Primary navigation" className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" className="font-bold text-foreground hover:text-primary">
              <a href="/sign-in">Log in</a>
            </Button>
            <Button asChild className="homepage-primary-button hidden sm:inline-flex">
              <a href="/sign-up">Get Started</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate min-h-[calc(100svh-5rem)] overflow-hidden" aria-labelledby="hero-title">
          <div className="absolute inset-0 -z-10">
            <img src="/opengraph.jpg" alt="Dump truck hauling through a construction environment at dusk" className="h-full w-full object-cover opacity-70" width="1024" height="576" fetchPriority="high" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/88 to-background/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/75" />
            <div className="homepage-carbon absolute inset-0 opacity-25" aria-hidden="true" />
            <div className="homepage-light-sweep absolute inset-y-0 left-0 w-2/3" aria-hidden="true" />
          </div>
          <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-[1680px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-10">
            <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
              <div className="homepage-kicker mb-7 rounded-none">
                <span className="homepage-pulse-orb h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                Premium nationwide hauling marketplace
              </div>
              <h1 id="hero-title" className="max-w-5xl text-6xl font-black uppercase leading-[0.82] tracking-[-0.075em] text-foreground sm:text-8xl lg:text-9xl xl:text-[10.75rem]">
                MOVE MORE.
                <br />
                <span className="text-primary">WAIT LESS.</span>
              </h1>
              <p className="mt-8 max-w-2xl text-xl leading-relaxed text-muted-foreground sm:text-2xl">
                America's Premium Marketplace for Dump Truck Hauling.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg" className="homepage-primary-button h-14 px-8 text-base">
                  <a href="/sign-up">
                    <Search className="h-5 w-5" />
                    Find Trucks
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="homepage-outline-button h-14 px-8 text-base">
                  <a href="/sign-up">
                    Become a Driver
                    <ArrowRight className="h-5 w-5" />
                  </a>
                </Button>
              </div>
            </div>
            <aside className="homepage-hero-glow homepage-steel animate-in fade-in slide-in-from-right-8 rounded-none border border-primary/20 p-4 duration-700" aria-label="Live dispatch preview">
              <div className="border border-foreground/10 bg-background/80 p-5 backdrop-blur">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Live dispatch board</p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight">Nationwide Load Flow</h2>
                  </div>
                  <Badge className="rounded-none font-black uppercase tracking-[0.12em]">Live</Badge>
                </div>
                <div className="grid gap-3">
                  {["Rock quarry transfer", "Asphalt night run", "Demo haul-off"].map((job, index) => (
                    <div key={job} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border border-border bg-card/70 p-4">
                      <div className="flex h-11 w-11 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
                        <Truck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-black">{job}</p>
                        <p className="mt-1 text-sm text-muted-foreground">ETA {9 + index * 8} min - GPS active - ticket ready</p>
                      </div>
                      <p className="font-mono text-xl font-black text-primary">${(1280 + index * 520).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  {["82 trucks", "41 jobs", "13 states"].map((label) => (
                    <div key={label} className="border border-border bg-muted/40 p-3 font-mono text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
          <a href="#marketplace" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-muted-foreground transition-colors hover:text-primary md:flex">
            Scroll
            <ChevronDown className="homepage-scroll-indicator h-6 w-6 text-primary" aria-hidden="true" />
          </a>
        </section>

        <section id="marketplace" className="border-y border-primary/20 bg-background/90 py-12" aria-labelledby="marketplace-title">
          <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-10">
            <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-primary">Live marketplace</p>
                <h2 id="marketplace-title" className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Capacity, demand, and payouts in motion.</h2>
              </div>
              <p className="max-w-2xl text-muted-foreground">
                Animated marketplace signals communicate national scale without changing dispatch, marketplace, or payment logic.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {marketplaceMetrics.map((metric) => (
                <AnimatedMetric key={metric.label} {...metric} />
              ))}
            </div>
          </div>
        </section>

        <section id="coverage" className="py-20 sm:py-28" aria-labelledby="coverage-title">
          <div className="mx-auto grid max-w-[1680px] gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
            <div className="flex flex-col justify-center">
              <div className="homepage-kicker mb-6 rounded-none">
                <Map className="h-4 w-4" />
                Interactive coverage
              </div>
              <h2 id="coverage-title" className="text-4xl font-black tracking-tight sm:text-6xl">Truck markers, jobs, routes, and ETAs at marketplace scale.</h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                The public homepage shows a premium live-operations visual using existing marketplace concepts. Backend dispatch, maps, notifications, and pricing logic remain untouched.
              </p>
            </div>
            <Card className="homepage-card homepage-map-grid relative min-h-[560px] overflow-hidden rounded-none">
              <CardContent className="absolute inset-0 p-0">
                <div className="absolute left-[10%] top-[20%] h-px w-[78%] rotate-12 homepage-route-line" aria-hidden="true" />
                <div className="absolute left-[18%] top-[68%] h-px w-[62%] -rotate-12 homepage-route-line" aria-hidden="true" />
                <div className="absolute left-[38%] top-[44%] h-px w-[38%] rotate-45 homepage-route-line" aria-hidden="true" />
                {mapMarkers.map((marker) => (
                  <HoverCard key={marker.label}>
                    <HoverCardTrigger asChild>
                      <button type="button" className={`absolute ${marker.className} flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 border border-primary/50 bg-background/80 px-3 py-2 text-left shadow-2xl backdrop-blur transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
                        <span className="homepage-pulse-orb h-3 w-3 rounded-full bg-primary" aria-hidden="true" />
                        <span>
                          <span className="block text-xs font-black uppercase tracking-[0.14em]">{marker.label}</span>
                          <span className="block text-xs text-muted-foreground">{marker.meta}</span>
                        </span>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent className="rounded-none border-primary/30 bg-popover">
                      <p className="font-black">{marker.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Dispatcher activity, ETA markers, customer jobs, and route coverage remain presentation-only on the public page.</p>
                    </HoverCardContent>
                  </HoverCard>
                ))}
                <div className="absolute bottom-5 left-5 right-5 grid gap-3 md:grid-cols-4">
                  {["Live truck markers", "Customer jobs", "Routes", "Dispatcher activity"].map((item) => (
                    <div key={item} className="border border-border bg-background/75 p-3 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
                      {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="features" className="border-y border-border bg-background/80 py-20 sm:py-28" aria-labelledby="features-title">
          <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-10">
            <div className="mb-14 max-w-4xl">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-primary">Feature grid</p>
              <h2 id="features-title" className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Enterprise-grade hauling operations, presented with industrial clarity.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {features.map((feature) => (
                <Card key={feature.title} className="homepage-card rounded-none">
                  <CardHeader>
                    <div className="mb-5 flex h-12 w-12 items-center justify-center border border-primary/35 bg-primary/10 text-primary">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl font-black">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="industries" className="py-20 sm:py-28" aria-labelledby="industries-title">
          <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-10">
            <div className="mb-12 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-primary">Industries</p>
                <h2 id="industries-title" className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Built for heavy material movement.</h2>
              </div>
              <p className="text-lg leading-relaxed text-muted-foreground">
                Construction, quarry, aggregate, asphalt, ready mix, mining, utilities, heavy civil, demolition, agriculture, commercial, and municipal work all land in one premium marketplace story.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {industries.map((industry) => (
                <div key={industry} className="homepage-steel border border-border p-5 text-lg font-black uppercase tracking-[0.12em] transition-colors hover:border-primary/50">
                  {industry}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-background/80 py-20 sm:py-28" aria-labelledby="mobile-title">
          <div className="mx-auto grid max-w-[1680px] gap-12 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
            <div className="flex flex-col justify-center">
              <div className="homepage-kicker mb-6 rounded-none">
                <Smartphone className="h-4 w-4" />
                Mobile preview
              </div>
              <h2 id="mobile-title" className="text-4xl font-black tracking-tight sm:text-6xl">Existing mobile workflows, framed for buyers and drivers.</h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                The phone mockups showcase current dispatch, map, ticket, and notification concepts without redesigning authenticated mobile UX.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { title: "Dispatch", icon: RadioTower, lines: ["Active Jobs", "Open Requests", "Pending Bids"] },
                { title: "Map", icon: MapPin, lines: ["Nearby Loads", "Surge Zone", "Search Area"] },
                { title: "Tickets", icon: ClipboardCheck, lines: ["Upload Proof", "Driver Rating", "Payout Ready"] },
              ].map((phone, index) => (
                <div key={phone.title} className={`homepage-phone rounded-[2rem] border border-border bg-background p-4 ${index === 1 ? "md:mt-10" : ""}`}>
                  <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-muted" />
                  <div className="min-h-[420px] border border-border bg-card p-4">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground">HaulBrokr</p>
                        <h3 className="text-xl font-black">{phone.title}</h3>
                      </div>
                      <phone.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-3">
                      {phone.lines.map((line) => (
                        <div key={line} className="border border-border bg-background/80 p-3">
                          <p className="font-black">{line}</p>
                          <div className="mt-3 h-2 bg-muted" />
                          <div className="mt-2 h-2 w-2/3 bg-primary/40" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <span className="h-10 border border-primary/40 bg-primary/10" />
                      <span className="h-10 border border-border bg-muted/50" />
                      <span className="h-10 border border-border bg-muted/50" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-28" aria-labelledby="how-title">
          <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-10">
            <div className="mx-auto mb-14 max-w-4xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-primary">How it works</p>
              <h2 id="how-title" className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Clean workflows for contractors and drivers.</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {[
                { title: "Contractor", icon: HardHat, steps: contractorSteps },
                { title: "Driver", icon: Truck, steps: driverSteps },
              ].map((flow) => (
                <Card key={flow.title} className="homepage-card rounded-none">
                  <CardHeader className="flex-row items-center gap-4 space-y-0 border-b border-border">
                    <div className="flex h-14 w-14 items-center justify-center border border-primary/35 bg-primary/10 text-primary">
                      <flow.icon className="h-7 w-7" />
                    </div>
                    <CardTitle className="text-3xl font-black">{flow.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 p-6 sm:grid-cols-2">
                    {flow.steps.map((step, index) => (
                      <div key={step} className="flex items-center gap-4 border border-border bg-background/70 p-4">
                        <span className="font-mono text-2xl font-black text-primary">{String(index + 1).padStart(2, "0")}</span>
                        <span className="font-black">{step}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="trust" className="border-y border-primary/20 bg-background/90 py-20 sm:py-28" aria-labelledby="trust-title">
          <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-10">
            <div className="mb-12 max-w-4xl">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-primary">Trust section</p>
              <h2 id="trust-title" className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">The signals enterprise buyers expect before moving material.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {trustItems.map((item) => (
                <div key={item.title} className="homepage-steel border border-border p-5 text-center">
                  <item.icon className="mx-auto h-8 w-8 text-primary" />
                  <p className="mt-4 text-sm font-black uppercase tracking-[0.16em]">{item.title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-24 sm:py-36" aria-labelledby="cta-title">
          <div className="absolute inset-0 -z-10">
            <img src="/opengraph.jpg" alt="" className="h-full w-full object-cover opacity-35" width="1024" height="576" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/55" />
            <div className="homepage-carbon absolute inset-0 opacity-20" aria-hidden="true" />
          </div>
          <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-10">
            <div className="max-w-4xl">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-primary">Ready to move?</p>
              <h2 id="cta-title" className="mt-4 text-5xl font-black tracking-tight sm:text-7xl">Put premium hauling capacity to work.</h2>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg" className="homepage-primary-button h-14 px-8 text-base">
                  <a href="/sign-up">Find Trucks</a>
                </Button>
                <Button asChild size="lg" variant="outline" className="homepage-outline-button h-14 px-8 text-base">
                  <a href="/sign-up">Become a Driver</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background py-16" aria-label="Footer">
        <div className="mx-auto grid max-w-[1680px] gap-10 px-4 sm:px-6 lg:grid-cols-[1.2fr_2fr] lg:px-10">
          <div>
            <img src="/haulbrokr-logo.png" alt="HaulBrokr" className="h-12 w-auto" width="1024" height="576" loading="lazy" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              HaulBrokr is the premium nationwide marketplace for dump truck hauling.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/sign-up" className="border border-border px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground hover:border-primary hover:text-primary">App Store</a>
              <a href="/sign-up" className="border border-border px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground hover:border-primary hover:text-primary">Google Play</a>
            </div>
          </div>
          <div className="grid gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["About", "Drivers", "Contractors", "Fleet"],
              ["Safety", "Careers", "Support", "Contact"],
              ["Terms", "Privacy", "Social"],
              ["Construction", "Quarry", "Mining", "Municipal"],
              ["Find Trucks", "Become a Driver", "Live Jobs"],
            ].map((column, index) => (
              <div key={column[0]}>
                <h3 className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-primary">0{index + 1}</h3>
                <ul className="space-y-3">
                  {column.map((item) => (
                    <li key={item}>
                      <a href={item === "Privacy" ? "/privacy" : item === "Support" || item === "Contact" ? "/support" : "/sign-up"} className="text-sm font-bold text-muted-foreground transition-colors hover:text-primary">
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-12 flex max-w-[1680px] flex-col gap-3 border-t border-border px-4 pt-6 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <p>© {new Date().getFullYear()} HaulBrokr Logistics. All rights reserved.</p>
          <p className="font-mono uppercase tracking-[0.16em]">Haul More. Earn More.</p>
        </div>
      </footer>
    </div>
  );
}
