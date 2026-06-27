import { ArrowRight, CheckCircle2, ClipboardCheck, DollarSign, FileText, HardHat, LayoutDashboard, MapPin, Navigation, Search, ShieldCheck, Truck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/haulbrokr-logo.png";
import logoWebp from "@/assets/haulbrokr-logo.webp";
import heroTruck from "@/assets/hero-truck.png";
import heroTruckWebp from "@/assets/hero-truck.webp";
import heroTruckSmWebp from "@/assets/hero-truck-sm.webp";
import ctaTruck from "@/assets/cta-truck.png";
import ctaTruckWebp from "@/assets/cta-truck.webp";

const steps = [
  { icon: FileText, title: "Post the job", desc: "Create a haul request with pickup, material, truck count, and schedule." },
  { icon: Truck, title: "Match trucks", desc: "Available haulers see nearby work and respond faster." },
  { icon: MapPin, title: "Track live", desc: "Follow check-in, route status, load progress, and completion." },
  { icon: CheckCircle2, title: "Close clean", desc: "Capture proof, load tickets, photos, and billing records." },
];

const features = [
  { icon: Zap, title: "Fast dispatch", desc: "Replace phone calls and spreadsheets with one job board." },
  { icon: Navigation, title: "GPS visibility", desc: "See where trucks are and where work is moving." },
  { icon: ClipboardCheck, title: "Digital tickets", desc: "Keep load photos, timestamps, and signed proof organized." },
  { icon: ShieldCheck, title: "Verified network", desc: "Support approval workflows for haulers, fleets, and documents." },
  { icon: LayoutDashboard, title: "Control dashboard", desc: "Manage requests, bids, active hauls, billing, and reporting." },
  { icon: DollarSign, title: "Payment ready", desc: "Cleaner job records help contractors and vendors close faster." },
];

const roles = [
  { icon: HardHat, title: "Contractors", desc: "Request trucks, compare activity, and keep the jobsite moving." },
  { icon: Truck, title: "Haulers", desc: "Find more loads and reduce idle time between jobs." },
  { icon: LayoutDashboard, title: "Fleet owners", desc: "Manage trucks, drivers, jobs, and documents in one place." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#070707] text-white antialiased selection:bg-[#ff6a00] selection:text-black">
      <header className="sticky top-0 z-50 border-b border-[#ff6a00]/20 bg-black/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:h-20">
          <a href="/" aria-label="HaulBrokr home">
            <picture>
              <source type="image/webp" srcSet={logoWebp} />
              <img src={logo} alt="HaulBrokr" className="h-8 w-auto sm:h-10" width="400" height="225" />
            </picture>
          </a>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="bg-transparent font-bold text-white hover:text-[#ff6a00]"><a href="/sign-in">Log in</a></Button>
            <Button asChild className="neon-orange bg-[#ff6a00] font-extrabold text-white hover:bg-[#e85f00]"><a href="/sign-up">Get Started</a></Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <picture>
              <source type="image/webp" srcSet={`${heroTruckSmWebp} 768w, ${heroTruckWebp} 1408w`} sizes="100vw" />
              <img src={heroTruck} alt="Dump truck on construction site" className="h-full w-full object-cover opacity-70" fetchPriority="high" width="1408" height="768" />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/35" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-transparent to-black/60" />
            <div className="absolute right-[-12rem] top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-[#ff6a00]/20 blur-3xl" />
          </div>
          <div className="container mx-auto grid min-h-[760px] items-center gap-12 px-4 py-20 lg:grid-cols-[1.1fr_.9fr]">
            <div className="max-w-4xl">
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[#ff6a00]/40 bg-black/60 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.28em] text-[#ff6a00]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff6a00]" /> Premium hauling marketplace
              </div>
              <h1 className="text-haulbrokr-glow text-6xl font-black uppercase leading-[0.84] tracking-[-0.07em] sm:text-7xl lg:text-9xl">
                Move More.<br /><span className="text-[#ff6a00]">Wait Less.</span>
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/72 sm:text-xl">
                HaulBrokr connects contractors, dump truck operators, and fleet owners with real-time dispatch, tracking, digital load tickets, and payment-ready records.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg" className="neon-orange h-14 bg-[#ff6a00] px-8 text-base font-black text-white hover:bg-[#e85f00]"><a href="/sign-up"><Search className="mr-2 h-5 w-5" />Find Trucks</a></Button>
                <Button asChild size="lg" variant="outline" className="h-14 border-2 border-white/25 bg-black/40 px-8 text-base font-black text-white hover:border-[#ff6a00] hover:bg-[#ff6a00]/10"><a href="/sign-up">Join the Network<ArrowRight className="ml-2 h-5 w-5" /></a></Button>
              </div>
            </div>
            <div className="industrial-panel rounded-[2rem] p-5">
              <div className="relative z-10 rounded-[1.5rem] border border-white/10 bg-black/65 p-5 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#ff6a00]">Live dispatch board</p>
                <h2 className="mt-1 text-2xl font-black">Today's Work</h2>
                <div className="mt-5 grid gap-3">
                  {["Rock and gravel load", "Demo haul-off", "Asphalt transfer"].map((job, index) => (
                    <div key={job} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div><p className="font-extrabold">{job}</p><p className="mt-1 text-sm text-white/50">ETA {12 + index * 7} min • GPS active</p></div>
                        <p className="text-lg font-black text-[#ff6a00]">${(850 + index * 420).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#ff6a00]/20 bg-black/80">
          <div className="container mx-auto grid grid-cols-2 gap-4 px-4 py-8 sm:grid-cols-4">
            {["50 States", "Live GPS", "Digital Tickets", "Fast Dispatch"].map((stat) => <div key={stat} className="industrial-panel rounded-2xl p-5 text-center font-black text-[#ff6a00]">{stat}</div>)}
          </div>
        </section>

        <section className="py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-14 max-w-3xl text-center"><p className="text-sm font-black uppercase tracking-[0.28em] text-[#ff6a00]">Simple by design</p><h2 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">From request to completed load.</h2></div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{steps.map((step, i) => <div key={step.title} className="industrial-panel rounded-3xl p-6"><div className="relative z-10 flex items-center justify-between"><step.icon className="h-7 w-7 text-[#ff6a00]" /><span className="text-4xl font-black text-white/10">0{i + 1}</span></div><h3 className="relative z-10 mt-6 text-xl font-black">{step.title}</h3><p className="relative z-10 mt-2 text-white/60">{step.desc}</p></div>)}</div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0b0b0b] py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <div className="mb-14 max-w-3xl"><p className="text-sm font-black uppercase tracking-[0.28em] text-[#ff6a00]">Built for heavy work</p><h2 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Industrial software for real jobsites.</h2></div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{features.map((f) => <div key={f.title} className="rounded-3xl border border-white/10 bg-black p-7 hover:border-[#ff6a00]/50"><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff6a00]/12 text-[#ff6a00]"><f.icon className="h-7 w-7" /></div><h3 className="text-xl font-black">{f.title}</h3><p className="mt-2 text-white/58">{f.desc}</p></div>)}</div>
          </div>
        </section>

        <section className="py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-14 max-w-3xl text-center"><p className="text-sm font-black uppercase tracking-[0.28em] text-[#ff6a00]">One platform</p><h2 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">For everyone moving material.</h2></div>
            <div className="grid gap-5 md:grid-cols-3">{roles.map((r) => <div key={r.title} className="industrial-panel rounded-3xl p-8 text-center"><div className="relative z-10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ff6a00] text-white neon-orange"><r.icon className="h-8 w-8" /></div><h3 className="relative z-10 text-2xl font-black">{r.title}</h3><p className="relative z-10 mt-2 text-white/60">{r.desc}</p></div>)}</div>
          </div>
        </section>

        <section className="relative overflow-hidden border-y border-[#ff6a00]/20">
          <div className="absolute inset-0"><picture><source type="image/webp" srcSet={ctaTruckWebp} /><img src={ctaTruck} alt="" className="h-full w-full object-cover opacity-60" loading="lazy" width="1408" height="768" /></picture><div className="absolute inset-0 bg-gradient-to-l from-black via-black/85 to-black/45" /></div>
          <div className="container relative z-10 mx-auto px-4 py-24 sm:py-36"><div className="ml-auto max-w-2xl text-right"><p className="text-sm font-black uppercase tracking-[0.28em] text-[#ff6a00]">Ready to move?</p><h2 className="mt-4 text-5xl font-black tracking-tight sm:text-7xl">Put trucks to work today.</h2><div className="mt-10"><Button asChild size="lg" className="neon-orange h-14 bg-[#ff6a00] px-8 text-base font-black text-white hover:bg-[#e85f00]"><a href="/sign-up">Get Started</a></Button></div></div></div>
        </section>
      </main>

      <footer className="bg-black py-14"><div className="container mx-auto px-4"><div className="flex flex-col items-center gap-6 text-center"><picture><source type="image/webp" srcSet={logoWebp} /><img src={logo} alt="HaulBrokr" className="h-9 w-auto" width="400" height="225" /></picture><div className="flex items-center gap-6 text-sm font-bold text-white/50"><a href="/support" className="hover:text-[#ff6a00]">Support</a><a href="/privacy" className="hover:text-[#ff6a00]">Privacy</a><a href="mailto:info@haulbrokr.com" className="hover:text-[#ff6a00]">Contact</a></div><p className="text-sm text-white/35">© {new Date().getFullYear()} HaulBrokr Logistics. All rights reserved.</p></div></div></footer>
    </div>
  );
}
