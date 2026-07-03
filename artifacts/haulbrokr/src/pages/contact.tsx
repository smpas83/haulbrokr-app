import { Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingLayout, MarketingPageHero } from "@/components/marketing/MarketingLayout";

const SUPPORT_EMAIL = "info@haulbrokr.com";

export default function ContactPage() {
  return (
    <MarketingLayout>
      <MarketingPageHero
        eyebrow="Contact"
        title="Talk with the HaulBrokr team."
        description="Questions about onboarding, billing, compliance, or enterprise dispatch? Reach out and our team will respond."
      />
      <section className="py-20 sm:py-28">
        <div className="container mx-auto max-w-2xl px-4">
          <div className="grid gap-6">
            <article className="rounded-3xl border border-white/10 bg-black p-8">
              <div className="flex items-center gap-3">
                <Mail className="h-6 w-6 text-[#ff6a00]" aria-hidden="true" />
                <h2 className="text-xl font-black">Email</h2>
              </div>
              <p className="mt-4 text-white/65">
                For account, billing, and support questions:
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-2 inline-block text-lg font-bold text-[#ff6a00] hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </article>

            <article className="rounded-3xl border border-white/10 bg-black p-8">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-[#ff6a00]" aria-hidden="true" />
                <h2 className="text-xl font-black">Help center</h2>
              </div>
              <p className="mt-4 text-white/65">
                Browse common questions about getting started, posting loads, payouts, and billing.
              </p>
              <Button asChild className="mt-4 neon-orange bg-[#ff6a00] font-extrabold text-white hover:bg-[#e85f00]">
                <a href="/support">Visit Support</a>
              </Button>
            </article>
          </div>

          {/* PLACEHOLDER: Contact form UI — awaiting ChatGPT visual package */}
          <p className="mt-10 text-center text-sm text-white/40">
            A structured contact form with routing by topic will be added in the final design package.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
