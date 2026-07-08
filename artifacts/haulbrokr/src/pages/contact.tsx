import { Truck, Mail, MessageSquare, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "info@haulbrokr.com";

export default function ContactPage() {
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
          <Button asChild variant="ghost" className="font-semibold">
            <a href="/sign-in">Log in</a>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-16 md:py-24 px-4 bg-card border-b border-border">
          <div className="container mx-auto max-w-5xl">
            <p className="font-mono text-sm uppercase tracking-widest text-primary mb-4">
              Contact
            </p>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-foreground">
              Get in touch
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Questions about loads, billing, payouts, or enterprise pricing?
              Our team responds within one business day.
            </p>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="container mx-auto max-w-5xl grid md:grid-cols-2 gap-8">
            <div className="border border-border/60 bg-card p-8 space-y-4">
              <Mail className="h-8 w-8 text-primary" />
              <h2 className="text-xl font-bold">Email support</h2>
              <p className="text-muted-foreground">
                For account help, billing questions, and partnership inquiries.
              </p>
              <a href={`mailto:${SUPPORT_EMAIL}`}>
                <Button className="font-semibold mt-2">
                  {SUPPORT_EMAIL}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
            <div className="border border-border/60 bg-card p-8 space-y-4">
              <MessageSquare className="h-8 w-8 text-primary" />
              <h2 className="text-xl font-bold">Help center</h2>
              <p className="text-muted-foreground">
                Browse FAQs on posting loads, payouts, and account setup.
              </p>
              <Button asChild variant="outline" className="font-semibold mt-2">
                <a href="/support">Visit support</a>
              </Button>
            </div>
            <div className="border border-border/60 bg-card p-8 space-y-4 md:col-span-2">
              <Clock className="h-8 w-8 text-primary" />
              <h2 className="text-xl font-bold">Response times</h2>
              <p className="text-muted-foreground">
                Standard support: within 1 business day. Urgent payout or
                payment issues are prioritized for active jobs.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-card border-t border-border py-12 px-4 text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-6 mb-4 text-sm font-semibold">
          <a href="/" className="hover:text-primary">
            Home
          </a>
          <a href="/about" className="hover:text-primary">
            About
          </a>
          <a href="/terms" className="hover:text-primary">
            Terms
          </a>
          <a href="/privacy" className="hover:text-primary">
            Privacy
          </a>
        </div>
        <p>
          © {new Date().getFullYear()} HaulBrokr Logistics. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
