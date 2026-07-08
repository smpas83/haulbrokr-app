import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  FileText,
  HardHat,
  LayoutDashboard,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  Truck,
  Zap,
  Building2,
  Users,
  Sparkles,
  Globe,
  BarChart3,
  Clock,
  Star,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SurfacePanel,
  AnimatedNationMap,
  AiCopilotPreview,
  FaqSection,
} from "@/components/design";
import logo from "@/assets/haulbrokr-logo.png";
import logoWebp from "@/assets/haulbrokr-logo.webp";
import heroTruck from "@/assets/hero-truck.png";
import heroTruckWebp from "@/assets/hero-truck.webp";
import heroTruckSmWebp from "@/assets/hero-truck-sm.webp";
import ctaTruck from "@/assets/cta-truck.png";
import ctaTruckWebp from "@/assets/cta-truck.webp";

const PLATFORM_HIGHLIGHTS = [
  { label: "Coverage", value: "Nationwide", detail: "All 50 states" },
  { label: "Tracking", value: "Live GPS", detail: "On active hauls" },
  { label: "Compliance", value: "Verified", detail: "Document gates" },
  { label: "Dispatch", value: "AI-assisted", detail: "You stay in control" },
];

const steps = [
  {
    icon: FileText,
    title: "Post the job",
    desc: "Create a haul request with pickup, material, truck count, and schedule.",
  },
  {
    icon: Truck,
    title: "Match trucks",
    desc: "Available haulers see nearby work and respond faster.",
  },
  {
    icon: MapPin,
    title: "Track live",
    desc: "Follow check-in, route status, load progress, and completion.",
  },
  {
    icon: CheckCircle2,
    title: "Close clean",
    desc: "Capture proof, load tickets, photos, and billing records.",
  },
];

const features = [
  {
    icon: Zap,
    title: "AI dispatch",
    desc: "Intelligent load matching and route optimization powered by machine learning.",
  },
  {
    icon: Navigation,
    title: "GPS visibility",
    desc: "Real-time fleet tracking with live ETAs and geofenced check-ins.",
  },
  {
    icon: ClipboardCheck,
    title: "Digital tickets",
    desc: "Load photos, timestamps, and signed proof — all organized automatically.",
  },
  {
    icon: ShieldCheck,
    title: "Verified network",
    desc: "Compliance workflows for haulers, fleets, insurance, and documents.",
  },
  {
    icon: LayoutDashboard,
    title: "Mission control",
    desc: "Manage requests, bids, active hauls, billing, and analytics in one view.",
  },
  {
    icon: DollarSign,
    title: "Payment ready",
    desc: "Instant invoicing, factoring, and Stripe-powered payment processing.",
  },
];

const segments = [
  {
    icon: HardHat,
    title: "Contractors",
    subtitle: "Customer Portal",
    desc: "Request trucks, compare bids, track live hauls, and manage invoices from a luxury dashboard.",
    features: [
      "Book hauls in seconds",
      "Live truck tracking",
      "Digital invoicing",
      "AI assistant",
    ],
    cta: "Start hauling",
  },
  {
    icon: Truck,
    title: "Drivers",
    subtitle: "Driver App",
    desc: "One-handed mobile experience built for the cab. Huge buttons, GPS navigation, ticket upload.",
    features: [
      "One-tap check-in",
      "Camera ticket upload",
      "Turn-by-turn nav",
      "Breakdown reporting",
    ],
    cta: "Join as driver",
  },
  {
    icon: Building2,
    title: "Fleet Owners",
    subtitle: "Vendor Portal",
    desc: "Fleet dashboard with drivers, equipment, revenue analytics, dispatch, and compliance.",
    features: [
      "Fleet utilization",
      "Driver management",
      "Revenue analytics",
      "Maintenance tracking",
    ],
    cta: "Manage fleet",
  },
  {
    icon: Globe,
    title: "Enterprise",
    subtitle: "Platform",
    desc: "Multi-site dispatch, API integrations, accounting export (QuickBooks coming soon), and dedicated account management.",
    features: [
      "Multi-project dispatch",
      "Accounting export (preview)",
      "Custom workflows",
      "Dedicated support",
    ],
    cta: "Contact sales",
  },
];

const DISPATCH_FEATURES = [
  {
    title: "Post haul requests",
    desc: "Contractors publish pickup, material, truck count, and schedule.",
  },
  {
    title: "Match available trucks",
    desc: "Verified carriers browse open loads and submit bids.",
  },
  {
    title: "Track active jobs",
    desc: "Follow check-ins, route status, and completion in real time.",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "Free",
    period: "to post loads",
    desc: "For contractors exploring the network.",
    features: [
      "Post haul requests",
      "Compare bids",
      "Live tracking",
      "Digital tickets",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    name: "Pro Fleet",
    price: "3%",
    period: "per completed load",
    desc: "For owner-operators and small fleets.",
    features: [
      "Everything in Starter",
      "AI dispatch copilot",
      "Fleet dashboard",
      "Priority support",
    ],
    cta: "Join as vendor",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "volume pricing",
    desc: "For GCs and multi-site operations.",
    features: [
      "Dedicated CSM",
      "API access",
      "Custom workflows",
      "SLA & compliance",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];

const TESTIMONIALS = [
  {
    quote:
      "We cut dispatch time from 45 minutes to under five. HaulBrokr is the operating system our field teams actually use.",
    name: "Marcus Chen",
    role: "VP Operations",
    company: "Summit Earthworks",
  },
  {
    quote:
      "Drivers love the app. One hand, big buttons, tickets upload in seconds. Compliance finally stays ahead of us.",
    name: "Diana Reyes",
    role: "Fleet Owner",
    company: "Reyes Hauling LLC",
  },
  {
    quote:
      "Fortune 500 audit-ready documentation on every load. That's why we standardized on HaulBrokr nationally.",
    name: "James Whitfield",
    role: "Procurement Director",
    company: "Meridian Construction",
  },
];

const FAQ = [
  {
    question: "How does HaulBrokr pricing work?",
    answer:
      "Customers post loads for free. Vendors pay a transparent platform fee on completed loads. Enterprise teams receive custom volume pricing with dedicated support.",
  },
  {
    question: "Is HaulBrokr available nationwide?",
    answer:
      "Yes. The marketplace covers all 50 states with live load boards, verified haulers, and GPS tracking on active jobs.",
  },
  {
    question: "How does AI dispatch work?",
    answer:
      "The AI Copilot analyzes open loads, fleet location, and historical performance to recommend matches, route optimizations, and revenue opportunities — you stay in control of every dispatch decision.",
  },
  {
    question: "What compliance documents are supported?",
    answer:
      "W-9, insurance COI, DOT authority, vehicle registration, and custom document gates. Staff review queues keep your network verified.",
  },
  {
    question: "Can drivers use the mobile app offline?",
    answer:
      "Drivers can capture photos and complete check-ins with intermittent connectivity. Full sync resumes when the device reconnects.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:h-[4.5rem]">
          <a href="/" aria-label="HaulBrokr home">
            <picture>
              <source type="image/webp" srcSet={logoWebp} />
              <img
                src={logo}
                alt="HaulBrokr"
                className="h-8 w-auto sm:h-9"
                width="400"
                height="225"
              />
            </picture>
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a
              href="#platform"
              className="hover:text-foreground transition-colors"
            >
              Platform
            </a>
            <a href="#ai" className="hover:text-foreground transition-colors">
              AI
            </a>
            <a
              href="#pricing"
              className="hover:text-foreground transition-colors"
            >
              Pricing
            </a>
            <a
              href="#customers"
              className="hover:text-foreground transition-colors"
            >
              Customers
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="font-semibold text-muted-foreground hover:text-foreground"
            >
              <a href="/sign-in">Log in</a>
            </Button>
            <Button asChild variant="accent" className="font-semibold">
              <a href="/sign-up">Get Started</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <picture>
              <source
                type="image/webp"
                srcSet={`${heroTruckSmWebp} 768w, ${heroTruckWebp} 1408w`}
                sizes="100vw"
              />
              <img
                src={heroTruck}
                alt=""
                className="h-full w-full object-cover opacity-20"
                fetchPriority="high"
                width="1408"
                height="768"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
          </div>

          <div className="container mx-auto px-4 py-20 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div className="max-w-xl animate-slide-up">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  North America's #1 haul marketplace
                </div>
                <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl leading-[1.05]">
                  Move more.
                  <br />
                  <span className="text-gradient-primary">Wait less.</span>
                </h1>
                <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-lg">
                  The premium dump truck marketplace and AI dispatch platform.
                  Real-time tracking, digital tickets, and intelligent fleet
                  management.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="xl" variant="accent">
                    <a href="/sign-up">
                      <Search className="mr-2 h-5 w-5" />
                      Find Trucks
                    </a>
                  </Button>
                  <Button asChild size="xl" variant="outline">
                    <a href="/sign-up">
                      Join the Network
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="relative animate-fade-in">
                <SurfacePanel elevated className="p-1">
                  <AnimatedNationMap className="h-[420px]" />
                </SurfacePanel>
              </div>
            </div>
          </div>
        </section>

        {/* Platform highlights */}
        <section className="border-y border-border/50 bg-card/30">
          <div className="container mx-auto grid grid-cols-2 gap-px bg-border/30 sm:grid-cols-4 px-4">
            {PLATFORM_HIGHLIGHTS.map((stat) => (
              <div
                key={stat.label}
                className="bg-background py-8 px-6 text-center"
              >
                <p className="text-3xl font-bold stat-number text-foreground">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {stat.label}
                </p>
                {stat.detail && (
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {stat.detail}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Live Jobs + AI Copilot */}
        <section id="platform" className="py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                Platform preview
              </p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                Mission control for hauling
              </h2>
              <p className="mt-4 text-muted-foreground text-lg">
                Dispatch board and AI copilot designed for contractors, fleets,
                and drivers.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <SurfacePanel elevated className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                      Dispatch workflow
                    </p>
                    <h3 className="text-xl font-bold mt-1">How it works</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  {DISPATCH_FEATURES.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-xl border border-border/50 bg-muted/20 p-4 hover:border-primary/30 transition-colors"
                    >
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </SurfacePanel>
              <AiCopilotPreview />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-border/50 bg-card/20 py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                Simple by design
              </p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                From request to completed load
              </h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, i) => (
                <div
                  key={step.title}
                  className="industrial-panel rounded-2xl p-6 hover-elevate"
                >
                  <div className="relative z-10 flex items-center justify-between">
                    <step.icon className="h-6 w-6 text-primary" />
                    <span className="text-3xl font-bold text-muted-foreground/20">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="relative z-10 mt-5 text-lg font-semibold">
                    {step.title}
                  </h3>
                  <p className="relative z-10 mt-2 text-sm text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <div className="mb-14 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                Built for heavy work
              </p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                Industrial software for real jobsites
              </h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-border/50 bg-card p-7 hover:border-primary/30 hover-elevate transition-all"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Segments: Customer, Driver, Vendor, Enterprise */}
        <section className="border-y border-border/50 bg-card/20 py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                One platform
              </p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                Built for everyone moving material
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {segments.map((seg, i) => (
                <div
                  key={seg.title}
                  id={
                    i === 0
                      ? "customers"
                      : i === 1
                        ? "drivers"
                        : i === 3
                          ? "enterprise"
                          : undefined
                  }
                  className="industrial-panel rounded-2xl p-8 hover-elevate"
                >
                  <div className="relative z-10">
                    <div className="flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
                        <seg.icon className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {seg.subtitle}
                      </span>
                    </div>
                    <h3 className="mt-5 text-2xl font-bold">{seg.title}</h3>
                    <p className="mt-2 text-muted-foreground leading-relaxed">
                      {seg.desc}
                    </p>
                    <ul className="mt-5 space-y-2">
                      {seg.features.map((feat) => (
                        <li
                          key={feat}
                          className="flex items-center gap-2 text-sm"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          {feat}
                        </li>
                      ))}
                    </ul>
                    <Button asChild variant="outline" className="mt-6">
                      <a href="/sign-up">
                        {seg.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI */}
        <section id="ai" className="py-20 sm:py-28 border-t border-border/50">
          <div className="container mx-auto px-4">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                  Fleet intelligence
                </p>
                <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                  AI that understands hauling
                </h2>
                <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                  Enterprise-grade copilot for dispatchers and fleet owners.
                  Natural language commands, predictive insights, and actionable
                  recommendations — without replacing your judgment.
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    "Match loads to idle trucks in seconds",
                    "Forecast revenue and utilization",
                    "Flag compliance and maintenance risks",
                    "Voice-ready for the jobsite",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <Bot className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <AiCopilotPreview className="min-h-[420px]" />
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          className="py-20 sm:py-28 bg-card/20 border-y border-border/50"
        >
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                Transparent pricing
              </p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                Built to scale with your fleet
              </h2>
              <p className="mt-4 text-muted-foreground text-lg">
                No hidden fees. Pay when loads move.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
              {PRICING.map((plan) => (
                <div
                  key={plan.name}
                  className={cn(
                    "surface-panel rounded-2xl p-8 flex flex-col",
                    plan.highlighted &&
                      "ring-2 ring-primary/40 border-primary/30",
                  )}
                >
                  {plan.highlighted && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary mb-4">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {plan.desc}
                  </p>
                  <div className="mt-6 mb-6">
                    <span className="text-4xl font-bold stat-number">
                      {plan.price}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {plan.period}
                    </span>
                  </div>
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={plan.highlighted ? "default" : "outline"}
                    className="mt-8 w-full"
                  >
                    <a href="/sign-up">{plan.cta}</a>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials (illustrative marketing copy — not live customer data) */}
        <section className="py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                Illustrative customer stories
              </p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                Built for the field, loved in the boardroom
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Representative examples for marketing — not pulled from live
                production accounts.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <blockquote
                  key={t.name}
                  className="surface-panel rounded-2xl p-8 flex flex-col"
                >
                  <div className="flex gap-1 text-accent mb-4" aria-hidden>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-foreground leading-relaxed flex-1">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <footer className="mt-6 pt-6 border-t border-border/50">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.role}, {t.company}
                    </p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="py-20 sm:py-28 border-t border-border/50 bg-card/20"
        >
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="mb-12 text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                FAQ
              </p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight">
                Questions from the jobsite
              </h2>
            </div>
            <FaqSection items={FAQ} />
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <picture>
              <source type="image/webp" srcSet={ctaTruckWebp} />
              <img
                src={ctaTruck}
                alt=""
                className="h-full w-full object-cover opacity-15"
                loading="lazy"
                width="1408"
                height="768"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/70" />
          </div>
          <div className="container relative z-10 mx-auto px-4 py-24 sm:py-32 text-center">
            <div className="mx-auto max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                Ready to move?
              </div>
              <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
                Put trucks to work today
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Join thousands of contractors and haulers already on the
                platform.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="xl" variant="accent">
                  <a href="/sign-up">Get Started Free</a>
                </Button>
                <Button asChild size="xl" variant="outline">
                  <a href="/support">Talk to Sales</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30 py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 md:grid-cols-4">
            <div className="md:col-span-1">
              <picture>
                <source type="image/webp" srcSet={logoWebp} />
                <img
                  src={logo}
                  alt="HaulBrokr"
                  className="h-8 w-auto"
                  width="400"
                  height="225"
                />
              </picture>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                The premium dump truck marketplace and AI dispatch platform for
                North America.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">
                Platform
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="#platform"
                    className="hover:text-foreground transition-colors"
                  >
                    Load Board
                  </a>
                </li>
                <li>
                  <a
                    href="#platform"
                    className="hover:text-foreground transition-colors"
                  >
                    Fleet Tracking
                  </a>
                </li>
                <li>
                  <a
                    href="#platform"
                    className="hover:text-foreground transition-colors"
                  >
                    AI Dispatch
                  </a>
                </li>
                <li>
                  <a
                    href="#platform"
                    className="hover:text-foreground transition-colors"
                  >
                    Digital Tickets
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">
                Company
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="/about"
                    className="hover:text-foreground transition-colors"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="/support"
                    className="hover:text-foreground transition-colors"
                  >
                    Support
                  </a>
                </li>
                <li>
                  <a
                    href="/privacy"
                    className="hover:text-foreground transition-colors"
                  >
                    Privacy
                  </a>
                </li>
                <li>
                  <a
                    href="/terms"
                    className="hover:text-foreground transition-colors"
                  >
                    Terms
                  </a>
                </li>
                <li>
                  <a
                    href="/contact"
                    className="hover:text-foreground transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">
                Get Started
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="/sign-up"
                    className="hover:text-foreground transition-colors"
                  >
                    Create Account
                  </a>
                </li>
                <li>
                  <a
                    href="/sign-in"
                    className="hover:text-foreground transition-colors"
                  >
                    Sign In
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} HaulBrokr Logistics. All rights
              reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <Users className="h-4 w-4" />
              <Globe className="h-4 w-4" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
