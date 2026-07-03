import { ArrowRight, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPageLayout } from "@/components/public-page-layout";

const SUPPORT_EMAIL = "info@haulbrokr.com";

export default function ContactPage() {
  return (
    <PublicPageLayout
      eyebrow="Contact"
      title={<>Talk with the <span className="text-primary">HaulBrokr team.</span></>}
      description="Reach us for support, onboarding questions, partnership conversations, or account access help."
    >
      <section className="py-16 md:py-20 px-4 bg-background">
        <div className="container mx-auto max-w-5xl">
          <div className="border-2 border-border bg-card p-8 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">Email support</h2>
                <p className="text-muted-foreground max-w-md">
                  Include your account email, company name, and a short description so we can route your request quickly.
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

          <div className="mt-10 grid gap-px bg-border border-2 border-border md:grid-cols-2">
            <div className="bg-card p-8">
              <MessageSquare className="mb-4 h-8 w-8 text-primary" />
              <h3 className="text-xl font-bold">What to send</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Send load details, payout questions, billing requests, or onboarding blockers. Screenshots and job IDs help when available.
              </p>
            </div>
            <div className="bg-card p-8">
              <ShieldCheck className="mb-4 h-8 w-8 text-primary" />
              <h3 className="text-xl font-bold">Account access</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                If sign-in is unavailable, public support remains online and our team can help verify your account path.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
}
