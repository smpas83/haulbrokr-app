import { Truck, Mail, FileText, Scale, Shield, Users, CreditCard, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "info@haulbrokr.com";
const EFFECTIVE_DATE = "June 17, 2026";

const sections = [
  {
    icon: FileText,
    title: "Acceptance of terms",
    body: [
      "By using the HaulBrokr application or website, you agree to these Terms of Service. If you do not agree, do not use the service.",
      "HaulBrokr LLC may update these Terms at any time. Continued use after changes constitutes acceptance of the revised Terms.",
    ],
  },
  {
    icon: Users,
    title: "Description of service",
    body: [
      "HaulBrokr is a technology platform connecting customers who need materials hauled with licensed dump truck operators and hauling companies.",
      "HaulBrokr does not perform hauling services. All hauling and disposal is performed by independent providers who are solely responsible for the legality, safety, and quality of their services.",
    ],
  },
  {
    icon: Shield,
    title: "User eligibility",
    body: [
      "You must be at least 18 years old and operate a legally registered business or be a licensed sole proprietor.",
      "Providers must hold all required licenses, permits, and insurance to legally operate commercial hauling vehicles.",
      "You are responsible for maintaining accurate account information and the confidentiality of your credentials.",
    ],
  },
  {
    icon: Scale,
    title: "Marketplace responsibilities",
    body: [
      "Customers agree to accurately describe materials, quantities, and job requirements.",
      "Providers agree to honor accepted bids, maintain valid insurance and compliance documents, and perform services safely and lawfully.",
      "HaulBrokr may suspend accounts that violate these requirements or provide false information.",
    ],
  },
  {
    icon: CreditCard,
    title: "Payments & fees",
    body: [
      "Payments are processed through Stripe. HaulBrokr charges a platform fee on completed transactions as disclosed at checkout.",
      "Providers receive payouts to connected bank accounts after job completion, subject to Stripe verification and compliance review.",
      "Disputes regarding completed work should be reported through the platform or to support@haulbrokr.com.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Limitation of liability",
    body: [
      "HaulBrokr is provided \"as is\" without warranties of any kind. We are not liable for damages arising from hauling services performed by providers.",
      "To the maximum extent permitted by law, HaulBrokr's liability is limited to the fees paid to HaulBrokr in the twelve months preceding the claim.",
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
        <section className="py-16 md:py-24 px-4 bg-card border-b border-border relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
          <div className="container mx-auto max-w-5xl relative z-10">
            <p className="font-mono text-sm uppercase tracking-widest text-primary mb-4">Terms of Service</p>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-foreground leading-[1.1]">
              Clear terms for a <span className="text-primary">trusted marketplace.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
              These terms govern your use of the HaulBrokr platform as a customer, provider, or driver.
            </p>
            <p className="font-mono text-sm text-muted-foreground mt-6">Effective {EFFECTIVE_DATE}</p>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="container mx-auto max-w-3xl space-y-12">
            {sections.map((section) => (
              <div key={section.title} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <section.icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{section.title}</h2>
                </div>
                <ul className="space-y-3 text-muted-foreground leading-relaxed pl-1">
                  {section.body.map((paragraph) => (
                    <li key={paragraph} className="flex gap-3">
                      <span className="text-primary mt-1.5 shrink-0">•</span>
                      <span>{paragraph}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 px-4 bg-card border-t border-border">
          <div className="container mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold mb-4">Questions about these terms?</h2>
            <p className="text-muted-foreground mb-6">
              Contact our team and we'll respond within one business day.
            </p>
            <Button asChild size="lg">
              <a href={`mailto:${SUPPORT_EMAIL}`}>
                <Mail className="mr-2 h-4 w-4" />
                {SUPPORT_EMAIL}
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} HaulBrokr Logistics. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/support" className="hover:text-foreground transition-colors">Support</a>
            <a href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
              Home <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
