import { Truck, Mail, Rocket, PackagePlus, Wallet, ReceiptText, UserCog, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "info@haulbrokr.com";

const faqs = [
  {
    icon: Rocket,
    question: "Getting started",
    answer:
      "Create an account as a construction site (customer) or a fleet owner-operator (provider). Customers post haul requests; providers register their trucks and bid on open loads. Once your profile is complete, your dashboard shows everything in one place.",
  },
  {
    icon: PackagePlus,
    question: "Posting a load",
    answer:
      'From your dashboard, tap \u201cNew Request\u201d and enter the material, pickup and drop-off, quantity, and timing. Available fleets get notified instantly and send back bids \u2014 accept the one that works and the job goes live.',
  },
  {
    icon: Wallet,
    question: "Payouts",
    answer:
      "Providers connect a bank account during onboarding to receive payouts. After a job is marked complete, funds are transferred automatically, minus the platform fee. You can track payout status from the Account screen at any time.",
  },
  {
    icon: ReceiptText,
    question: "Billing",
    answer:
      "Customers are charged securely through Stripe when a job completes, using the card or bank account on file. Receipts are available in your account history. For net-terms or invoicing questions, reach out to our team by email.",
  },
  {
    icon: UserCog,
    question: "Account & access",
    answer:
      "Update your company details, contact info, and payment settings from the Account page. Need to change your role, recover access, or close your account? Email us and we'll take care of it.",
  },
];

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
              },
            })),
          }),
        }}
      />
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
            <p className="font-mono text-sm uppercase tracking-widest text-primary mb-4">Support</p>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-white leading-[1.1]">
              We're here to <span className="text-primary">keep you moving.</span>
            </h1>
            <p className="text-lg md:text-xl text-secondary-foreground/80 max-w-2xl">
              Questions about posting loads, payouts, or your account? Find quick answers below, or reach our team directly — we typically respond within one business day.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="py-16 px-4 bg-background border-b border-border">
          <div className="container mx-auto max-w-5xl">
            <div className="border-2 border-border bg-card p-8 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">Contact us</h2>
                  <p className="text-muted-foreground max-w-md">
                    Email our support team for help with any issue. Include your account email and a short description so we can assist you faster.
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

        {/* FAQ */}
        <section className="py-16 md:py-20 px-4 bg-background">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Common help topics</h2>
            <p className="text-muted-foreground mb-12 max-w-2xl">
              The quickest answers to the questions we hear most. Still stuck? Email us at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary font-bold hover:underline">
                {SUPPORT_EMAIL}
              </a>.
            </p>
            <div className="grid md:grid-cols-2 gap-px bg-border border-2 border-border">
              {faqs.map((faq) => (
                <div key={faq.question} className="bg-card p-8 space-y-4">
                  <div className="h-12 w-12 bg-primary/10 flex items-center justify-center text-primary">
                    <faq.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold">{faq.question}</h3>
                  <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                </div>
              ))}
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
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-primary">Contact</a>
        </div>
        <p>© {new Date().getFullYear()} HaulBrokr Logistics. All rights reserved.</p>
      </footer>
    </div>
  );
}
