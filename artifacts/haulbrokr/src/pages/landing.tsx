import {
  ArrowRight,
  Search,
  Truck,
  Bell,
  UserCheck,
  MapPin,
  CheckCircle2,
  DollarSign,
  FileText,
  Zap,
  Navigation,
  ClipboardCheck,
  LayoutDashboard,
  HardHat,
  Building2,
  Quote,
  Star,
  ShieldCheck,
  Lock,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/haulbrokr-logo.png";
import logoWebp from "@/assets/haulbrokr-logo.webp";
import heroTruck from "@/assets/hero-truck.png";
import heroTruckWebp from "@/assets/hero-truck.webp";
import heroTruckSmWebp from "@/assets/hero-truck-sm.webp";
import ctaTruck from "@/assets/cta-truck.png";
import ctaTruckWebp from "@/assets/cta-truck.webp";

const ORANGE = "#F2611F";

const steps = [
  { icon: FileText, title: "Contractor Posts Job", desc: "Post dirt, gravel, or demo haul-off in seconds." },
  { icon: Bell, title: "Nearby Trucks Notified", desc: "Available haulers nearby get pinged instantly." },
  { icon: UserCheck, title: "Driver Accepts", desc: "A verified driver claims the job and rolls out." },
  { icon: MapPin, title: "Driver Checks In", desc: "Live check-in at the site with photo proof." },
  { icon: CheckCircle2, title: "Job Completed", desc: "Load delivered, ticket signed, done." },
  { icon: DollarSign, title: "Payment Released", desc: "Funds released fast — no chasing invoices." },
];

const features = [
  { icon: Zap, title: "Instant Dispatch", desc: "Match jobs to available trucks in minutes, not hours." },
  { icon: Navigation, title: "Live GPS Tracking", desc: "Know exactly where every load is, in real time." },
  { icon: ClipboardCheck, title: "Driver Check-In", desc: "On-site check-ins with timestamps and photos." },
  { icon: FileText, title: "Digital Load Tickets", desc: "Paperless tickets and signatures on every haul." },
  { icon: Truck, title: "Fleet Management", desc: "See truck status, routes, and crews at a glance." },
  { icon: LayoutDashboard, title: "Contractor Dashboard", desc: "Manage jobs, bids, and spend from one screen." },
];

const stats = [
  { value: "10,000+", label: "Trucks" },
  { value: "50", label: "States" },
  { value: "Thousands", label: "of Jobs" },
];

const audiences = [
  { icon: HardHat, title: "For Contractors", desc: "Find reliable haulers fast and easy. Keep your site moving." },
  { icon: Truck, title: "For Drivers", desc: "More loads. More miles. More money in your pocket." },
  { icon: Building2, title: "For Fleet Owners", desc: "Manage your fleet and maximize profits, all in one place." },
];

const testimonials = [
  {
    quote:
      "I used to spend half my morning calling around for trucks. Now I post a job and have a verified hauler on site before lunch.",
    name: "Marcus Reyes",
    role: "Contractor",
  },
  {
    quote:
      "More loads, less dead time. The app keeps me booked and I get paid fast — no more chasing invoices for weeks.",
    name: "Travis Whitfield",
    role: "Driver",
  },
  {
    quote:
      "Running 18 trucks used to be a spreadsheet nightmare. HaulBrokr shows me every load and crew in one place.",
    name: "Dana Coleman",
    role: "Fleet Owner",
  },
];

const trustBadges = [
  { icon: ShieldCheck, title: "Verified & Insured Haulers" },
  { icon: Lock, title: "Secure Payments" },
  { icon: Banknote, title: "Fast Payouts" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased selection:bg-[#F2611F] selection:text-black">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
          <picture>
            <source type="image/webp" srcSet={logoWebp} />
            <img src={logo} alt="HaulBrokr" className="h-8 sm:h-10 w-auto" width="400" height="225" />
          </picture>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              asChild
              variant="ghost"
              className="font-semibold text-white hover:text-[#F2611F] bg-transparent"
            >
              <a href="/sign-in">Log in</a>
            </Button>
            <Button
              asChild
              className="font-bold bg-[#F2611F] text-white border-[#F2611F] hover:bg-[#d9530f]"
            >
              <a href="/sign-up">Get Started</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <picture>
              <source
                type="image/webp"
                srcSet={`${heroTruckSmWebp} 768w, ${heroTruckWebp} 1408w`}
                sizes="100vw"
              />
              <img
                src={heroTruck}
                alt=""
                className="h-full w-full object-cover"
                fetchPriority="high"
                width="1408"
                height="768"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
          </div>
          <div className="container mx-auto px-4 relative z-10 py-28 sm:py-40 lg:py-52">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#F2611F]/40 bg-[#F2611F]/10 px-4 py-1.5 mb-6 text-xs sm:text-sm font-bold uppercase tracking-widest text-[#F2611F]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F2611F] animate-pulse" />
                The #1 Hauling Marketplace
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-8xl font-extrabold tracking-tight leading-[0.95] mb-6">
                HAUL MORE.
                <br />
                <span className="text-[#F2611F]">EARN MORE.</span>
              </h1>
              <p className="text-lg sm:text-xl text-white/70 max-w-2xl mb-10 leading-relaxed">
                HaulBrokr connects contractors with reliable haulers so you can
                move dirt faster, easier, and smarter.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  asChild
                  size="lg"
                  className="h-14 px-8 text-base font-bold w-full sm:w-auto bg-[#F2611F] text-white border-[#F2611F] hover:bg-[#d9530f] shadow-lg shadow-[#F2611F]/20"
                >
                  <a href="/sign-up">
                    <Search className="mr-2 h-5 w-5" />
                    Find Trucks Now
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-base font-bold w-full sm:w-auto bg-transparent border-2 border-white/30 text-white hover:border-white hover:bg-white/5"
                >
                  <a href="/sign-up">
                    Join as a Driver
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Stats / trust strip */}
        <section className="border-y border-white/10 bg-[#0a0a0a]">
          <div className="container mx-auto px-4 py-10 sm:py-12">
            <div className="grid grid-cols-3 divide-x divide-white/10">
              {stats.map((s) => (
                <div key={s.label} className="px-1 sm:px-2 text-center">
                  <div className="text-xl sm:text-4xl lg:text-5xl font-extrabold text-[#F2611F] tracking-tight">
                    {s.value}
                  </div>
                  <div className="mt-1 text-xs sm:text-sm font-semibold uppercase tracking-widest text-white/50">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 sm:py-28 bg-black">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-sm font-bold uppercase tracking-widest text-[#F2611F] mb-3">
                Simple by design
              </p>
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                How HaulBrokr Works
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {steps.map((step, i) => (
                <div
                  key={step.title}
                  className="group relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6 transition-colors hover:border-[#F2611F]/50"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F2611F]/10 text-[#F2611F] transition-colors group-hover:bg-[#F2611F] group-hover:text-white">
                      <step.icon className="h-6 w-6" />
                    </div>
                    <span className="text-4xl font-extrabold text-white/10">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-1.5">{step.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 sm:py-28 bg-[#0a0a0a] border-y border-white/10">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-sm font-bold uppercase tracking-widest text-[#F2611F] mb-3">
                Built for the jobsite
              </p>
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                Powerful Features
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-white/10 bg-black p-7 transition-all hover:-translate-y-1 hover:border-[#F2611F]/50"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-[#F2611F]/10 text-[#F2611F] transition-colors group-hover:bg-[#F2611F] group-hover:text-white">
                    <f.icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                  <p className="text-white/60 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Audience strip */}
        <section className="py-20 sm:py-28 bg-black">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-sm font-bold uppercase tracking-widest text-[#F2611F] mb-3">
                One platform, every role
              </p>
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                Made For Everyone Who Moves Dirt
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {audiences.map((a) => (
                <div
                  key={a.title}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-8 text-center"
                >
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2611F] text-white">
                    <a.icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-extrabold mb-2">{a.title}</h3>
                  <p className="text-white/60 leading-relaxed">{a.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials + trust badges */}
        <section className="py-20 sm:py-28 bg-[#0a0a0a] border-y border-white/10">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-sm font-bold uppercase tracking-widest text-[#F2611F] mb-3">
                Trusted on the jobsite
              </p>
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                What Our Haulers Say
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {testimonials.map((t) => (
                <figure
                  key={t.name}
                  className="relative flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-8 transition-colors hover:border-[#F2611F]/50"
                >
                  <Quote className="h-8 w-8 text-[#F2611F]/40 mb-5" />
                  <div className="flex gap-1 mb-4" aria-label="5 out of 5 stars">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-[#F2611F] text-[#F2611F]"
                      />
                    ))}
                  </div>
                  <blockquote className="flex-1 text-white/80 leading-relaxed">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F2611F] text-base font-extrabold text-white">
                      {t.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <div className="font-bold leading-tight">{t.name}</div>
                      <div className="text-sm font-semibold uppercase tracking-wider text-[#F2611F]">
                        {t.role}
                      </div>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>

            {/* Trust badges */}
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {trustBadges.map((b) => (
                <div
                  key={b.title}
                  className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black px-6 py-5 text-center"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F2611F]/10 text-[#F2611F]">
                    <b.icon className="h-5 w-5" />
                  </div>
                  <span className="font-bold text-sm sm:text-base">
                    {b.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA band */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <picture>
              <source type="image/webp" srcSet={ctaTruckWebp} />
              <img
                src={ctaTruck}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                width="1408"
                height="768"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-l from-black via-black/80 to-black/50" />
          </div>
          <div className="container mx-auto px-4 relative z-10 py-24 sm:py-36">
            <div className="max-w-2xl ml-auto text-right">
              <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight mb-6">
                Ready to <span className="text-[#F2611F]">Haul More?</span>
              </h2>
              <p className="text-lg text-white/70 mb-10">
                Join thousands of contractors, drivers, and fleet owners moving
                dirt smarter with HaulBrokr.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-end">
                <Button
                  asChild
                  size="lg"
                  className="h-14 px-8 text-base font-bold w-full sm:w-auto bg-[#F2611F] text-white border-[#F2611F] hover:bg-[#d9530f] shadow-lg shadow-[#F2611F]/20"
                >
                  <a href="/sign-up">
                    <Search className="mr-2 h-5 w-5" />
                    Find Trucks
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-base font-bold w-full sm:w-auto bg-transparent border-2 border-white/30 text-white hover:border-white hover:bg-white/5"
                >
                  <a href="/sign-up">Join as a Driver</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black py-14">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center gap-6">
            <picture>
              <source type="image/webp" srcSet={logoWebp} />
              <img src={logo} alt="HaulBrokr" className="h-9 w-auto" width="400" height="225" />
            </picture>
            <div className="flex items-center gap-6 text-sm font-semibold text-white/60">
              <a href="/support" className="hover:text-[#F2611F]">
                Support
              </a>
              <a href="/privacy" className="hover:text-[#F2611F]">
                Privacy
              </a>
              <a href="mailto:info@haulbrokr.com" className="hover:text-[#F2611F]">
                Contact
              </a>
            </div>
            <p className="text-sm text-white/40">
              © {new Date().getFullYear()} HaulBrokr Logistics. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
