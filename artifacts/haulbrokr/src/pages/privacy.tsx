import { Truck, Mail, Shield, Database, Share2, Lock, Clock, UserCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "info@haulbrokr.com";
const EFFECTIVE_DATE = "June 17, 2026";

const sections = [
  {
    icon: Database,
    title: "Information we collect",
    body: [
      "Account information you provide when you sign up, such as your name, email address, company name, role (customer or provider), and contact details.",
      "Operational data you enter to use the service, including haul requests, fleet and truck details, job activity, and messages.",
      "Payment information processed securely through Stripe. We do not store full card or bank account numbers on our servers; that data is handled directly by Stripe.",
      "Technical data such as device information, log data, and usage activity collected automatically when you use the app.",
    ],
  },
  {
    icon: UserCheck,
    title: "How we use your information",
    body: [
      "To create and manage your account and provide the HaulBrokr marketplace.",
      "To connect customers with providers, facilitate bids, jobs, and payouts, and process payments.",
      "To communicate with you about your account, jobs, receipts, and support requests.",
      "To maintain security, prevent fraud, comply with legal obligations, and improve the service.",
    ],
  },
  {
    icon: Share2,
    title: "How we share information",
    body: [
      "With other users as needed to complete a transaction — for example, sharing job and contact details between a customer and the provider they are working with.",
      "With service providers that help us operate, such as Stripe for payments and our authentication and hosting providers.",
      "When required by law, to protect our rights, or in connection with a business transfer.",
      "We do not sell your personal information.",
    ],
  },
  {
    icon: Lock,
    title: "Data security",
    body: [
      "We use industry-standard safeguards to protect your information, including encryption in transit and access controls.",
      "Payment data is handled by Stripe, a PCI-DSS compliant payment processor.",
      "No method of transmission or storage is completely secure, so we cannot guarantee absolute security.",
    ],
  },
  {
    icon: Clock,
    title: "Data retention",
    body: [
      "We keep your information for as long as your account is active or as needed to provide the service.",
      "We may retain certain information to comply with legal, tax, accounting, and dispute-resolution requirements after your account is closed.",
    ],
  },
  {
    icon: Shield,
    title: "Your rights & choices",
    body: [
      "You can access and update most of your information from the Account page within the app.",
      "You can request that we correct or delete your account information by emailing us.",
      "Depending on where you live, you may have additional rights under applicable privacy laws — contact us to exercise them.",
    ],
  },
];

export default function PrivacyPage() {
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
        {/* Hero */}
        <section className="py-16 md:py-24 px-4 bg-secondary text-secondary-foreground relative overflow-hidden">
          <div className="absolute inset-0" style={{background: "linear-gradient(135deg, hsl(217 33% 12%) 0%, hsl(217 33% 22%) 50%, hsl(45 60% 15%) 100%)"}}></div>
          <div className="container mx-auto max-w-5xl relative z-10">
            <p className="font-mono text-sm uppercase tracking-widest text-primary mb-4">Privacy Policy</p>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-white leading-[1.1]">
              Your data, <span className="text-primary">handled with care.</span>
            </h1>
            <p className="text-lg md:text-xl text-secondary-foreground/80 max-w-2xl">
              This policy explains what information HaulBrokr collects, how we use it, and the choices you have.
            </p>
            <p className="font-mono text-sm text-secondary-foreground/60 mt-6">Effective {EFFECTIVE_DATE}</p>
          </div>
        </section>

        {/* Intro */}
        <section className="py-16 px-4 bg-background border-b border-border">
          <div className="container mx-auto max-w-5xl">
            <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
              HaulBrokr Logistics ("HaulBrokr", "we", "us") operates a marketplace that connects construction
              sites and contractors with dump-truck fleets and owner-operators. This Privacy Policy applies to our
              website, mobile app, and related services. By using HaulBrokr, you agree to the practices described
              here.
            </p>
          </div>
        </section>

        {/* Sections */}
        <section className="py-16 md:py-20 px-4 bg-background">
          <div className="container mx-auto max-w-5xl">
            <div className="grid md:grid-cols-2 gap-px bg-border border-2 border-border">
              {sections.map((s) => (
                <div key={s.title} className="bg-card p-8 space-y-4">
                  <div className="h-12 w-12 bg-primary/10 flex items-center justify-center text-primary">
                    <s.icon className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-bold">{s.title}</h2>
                  <ul className="space-y-3">
                    {s.body.map((line, i) => (
                      <li key={i} className="text-muted-foreground leading-relaxed flex gap-3">
                        <span className="text-primary mt-1.5 h-1.5 w-1.5 bg-primary shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Children & changes */}
        <section className="py-4 px-4 bg-background">
          <div className="container mx-auto max-w-5xl space-y-8">
            <div className="border-2 border-border bg-card p-8 space-y-3">
              <h2 className="text-xl font-bold">Children's privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                HaulBrokr is intended for business use by adults and is not directed to children under 18. We do not
                knowingly collect personal information from children.
              </p>
            </div>
            <div className="border-2 border-border bg-card p-8 space-y-3">
              <h2 className="text-xl font-bold">Changes to this policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. When we do, we will revise the effective date
                above and, where appropriate, notify you within the app.
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="py-16 px-4 bg-background">
          <div className="container mx-auto max-w-5xl">
            <div className="border-2 border-border bg-card p-8 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">Questions about your privacy?</h2>
                  <p className="text-muted-foreground max-w-md">
                    Contact us about this policy or to exercise your data rights and we'll respond promptly.
                  </p>
                </div>
              </div>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="shrink-0">
                <Button size="lg" className="text-base h-12 px-6 font-bold w-full md:w-auto">
                  {SUPPORT_EMAIL}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-card border-t border-border py-12 px-4 text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-2 text-foreground font-bold text-xl mb-4">
          <Truck className="h-5 w-5 text-primary" />
          HaulBrokr
        </div>
        <div className="flex items-center justify-center gap-6 mb-4 text-sm font-semibold">
          <a href="/" className="hover:text-primary">Home</a>
          <a href="/support" className="hover:text-primary">Support</a>
          <a href="/privacy" className="hover:text-primary">Privacy</a>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-primary">Contact</a>
        </div>
        <p>© {new Date().getFullYear()} HaulBrokr Logistics. All rights reserved.</p>
      </footer>
    </div>
  );
}
