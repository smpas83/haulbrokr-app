import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/haulbrokr-logo.png";
import logoWebp from "@/assets/haulbrokr-logo.webp";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/industries", label: "Industries" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/support", label: "Support" },
  { href: "/contact", label: "Contact" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#ff6a00]/20 bg-black/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:h-20">
        <a href="/" aria-label="HaulBrokr home">
          <picture>
            <source type="image/webp" srcSet={logoWebp} />
            <img src={logo} alt="HaulBrokr" className="h-8 w-auto sm:h-10" width="400" height="225" />
          </picture>
        </a>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-2 text-sm font-bold text-white/70 hover:text-[#ff6a00] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="bg-transparent font-bold text-white hover:text-[#ff6a00]">
            <a href="/sign-in">Log in</a>
          </Button>
          <Button asChild className="neon-orange bg-[#ff6a00] font-extrabold text-white hover:bg-[#e85f00]">
            <a href="/sign-up">Get Started</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-black py-14">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <picture>
            <source type="image/webp" srcSet={logoWebp} />
            <img src={logo} alt="HaulBrokr" className="h-9 w-auto" width="400" height="225" />
          </picture>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-bold text-white/50" aria-label="Footer">
            <a href="/features" className="hover:text-[#ff6a00]">Features</a>
            <a href="/industries" className="hover:text-[#ff6a00]">Industries</a>
            <a href="/pricing" className="hover:text-[#ff6a00]">Pricing</a>
            <a href="/about" className="hover:text-[#ff6a00]">About</a>
            <a href="/support" className="hover:text-[#ff6a00]">Support</a>
            <a href="/contact" className="hover:text-[#ff6a00]">Contact</a>
            <a href="/privacy" className="hover:text-[#ff6a00]">Privacy</a>
            <a href="/terms" className="hover:text-[#ff6a00]">Terms</a>
          </nav>
          <p className="text-sm text-white/35">
            © {new Date().getFullYear()} HaulBrokr Logistics. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function MarketingLayout({
  children,
  className = "min-h-screen bg-[#070707] text-white antialiased selection:bg-[#ff6a00] selection:text-black",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}

export function MarketingPageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="border-b border-[#ff6a00]/20 bg-black/80 py-16 sm:py-24">
      <div className="container mx-auto max-w-3xl px-4 text-center">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-[#ff6a00]">{eyebrow}</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">{title}</h1>
        <p className="mt-6 text-lg leading-relaxed text-white/65">{description}</p>
      </div>
    </section>
  );
}
