import type { ReactNode } from "react";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "info@haulbrokr.com";

export function PublicPageLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  children: ReactNode;
}) {
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
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" className="font-semibold text-foreground hover:text-primary">
              <a href="/sign-in">Log in</a>
            </Button>
            <Button asChild className="font-semibold">
              <a href="/sign-up">Get Started</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-16 md:py-24 px-4 bg-secondary text-secondary-foreground relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(217 33% 12%) 0%, hsl(217 33% 22%) 50%, hsl(45 60% 15%) 100%)" }} />
          <div className="container mx-auto max-w-5xl relative z-10">
            <p className="font-mono text-sm uppercase tracking-widest text-primary mb-4">{eyebrow}</p>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-white leading-[1.1]">
              {title}
            </h1>
            <p className="text-lg md:text-xl text-secondary-foreground/80 max-w-2xl">
              {description}
            </p>
          </div>
        </section>
        {children}
      </main>

      <footer className="bg-card border-t border-border py-12 px-4 text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-2 text-foreground font-bold text-xl mb-4">
          <Truck className="h-5 w-5 text-primary" />
          HaulBrokr
        </div>
        <div className="flex items-center justify-center gap-6 mb-4 text-sm font-semibold">
          <a href="/" className="hover:text-primary">Home</a>
          <a href="/about" className="hover:text-primary">About</a>
          <a href="/support" className="hover:text-primary">Support</a>
          <a href="/privacy" className="hover:text-primary">Privacy</a>
          <a href="/terms" className="hover:text-primary">Terms</a>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-primary">Contact</a>
        </div>
        <p>© {new Date().getFullYear()} HaulBrokr Logistics. All rights reserved.</p>
      </footer>
    </div>
  );
}
