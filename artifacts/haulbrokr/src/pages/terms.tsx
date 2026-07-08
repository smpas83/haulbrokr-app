import {
  Truck,
  Mail,
  FileText,
  Scale,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "info@haulbrokr.com";
const EFFECTIVE_DATE = "June 17, 2026";

const sections = [
  {
    icon: FileText,
    title: "Acceptance of terms",
    body: [
      "By accessing or using HaulBrokr, you agree to these Terms of Service and our Privacy Policy.",
      "If you do not agree, do not use the platform.",
      "We may update these terms from time to time; continued use after changes constitutes acceptance.",
    ],
  },
  {
    icon: Scale,
    title: "Platform role",
    body: [
      "HaulBrokr is a marketplace connecting construction customers with independent hauling providers.",
      "We are not a motor carrier, broker of record, or employer of providers on the platform.",
      "Each party is responsible for compliance with applicable laws, licensing, and insurance requirements.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Payments & disputes",
    body: [
      "Payments are processed through Stripe. Customers authorize charges upon job completion unless otherwise agreed.",
      "Providers receive payouts minus applicable platform fees after verified completion.",
      "Disputes regarding job quality or payment should be reported promptly through support.",
    ],
  },
];

export default function TermsPage() {
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
            <Button asChild variant="ghost" className="font-semibold">
              <a href="/sign-in">Log in</a>
            </Button>
            <Button asChild className="font-semibold">
              <a href="/sign-up">Get Started</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-16 md:py-24 px-4 bg-card border-b border-border">
          <div className="container mx-auto max-w-5xl">
            <p className="font-mono text-sm uppercase tracking-widest text-primary mb-4">
              Legal
            </p>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-foreground">
              Terms of Service
            </h1>
            <p className="text-muted-foreground text-lg">
              Effective {EFFECTIVE_DATE}
            </p>
          </div>
        </section>

        <section className="py-12 px-4">
          <div className="container mx-auto max-w-5xl space-y-8">
            {sections.map((section) => (
              <div
                key={section.title}
                className="border border-border/60 bg-card p-8 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <section.icon className="h-6 w-6 text-primary" />
                  <h2 className="text-xl font-bold">{section.title}</h2>
                </div>
                <ul className="space-y-3">
                  {section.body.map((line, i) => (
                    <li
                      key={i}
                      className="text-muted-foreground leading-relaxed flex gap-3"
                    >
                      <span className="text-primary mt-1.5 h-1.5 w-1.5 bg-primary shrink-0" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 px-4 bg-background">
          <div className="container mx-auto max-w-5xl">
            <div className="border border-border/60 bg-card p-8 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">Questions?</h2>
                  <p className="text-muted-foreground max-w-md">
                    Contact us about these terms or your account.
                  </p>
                </div>
              </div>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="shrink-0">
                <Button size="lg" className="font-bold w-full md:w-auto">
                  {SUPPORT_EMAIL}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-card border-t border-border py-12 px-4 text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-6 mb-4 text-sm font-semibold">
          <a href="/" className="hover:text-primary">
            Home
          </a>
          <a href="/privacy" className="hover:text-primary">
            Privacy
          </a>
          <a href="/support" className="hover:text-primary">
            Support
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
