import { CheckCircle2, ClipboardCheck, MapPinned, Truck } from "lucide-react";
import { PublicPageLayout } from "@/components/public-page-layout";

const highlights = [
  {
    icon: Truck,
    title: "Built for heavy hauling",
    body: "HaulBrokr connects contractors, owner-operators, and fleets around jobsite hauling needs.",
  },
  {
    icon: MapPinned,
    title: "Live operating visibility",
    body: "Dispatch, location context, load progress, and ticket records live in one workflow.",
  },
  {
    icon: ClipboardCheck,
    title: "Cleaner closeout",
    body: "Digital records help teams reduce phone calls, missed paperwork, and payment delays.",
  },
];

export default function AboutPage() {
  return (
    <PublicPageLayout
      eyebrow="About HaulBrokr"
      title={<>Built to keep dirt <span className="text-primary">moving.</span></>}
      description="HaulBrokr is a hauling marketplace for construction teams that need reliable trucks, clearer job records, and fewer dispatch bottlenecks."
    >
      <section className="py-16 md:py-20 px-4 bg-background">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-3 gap-px bg-border border-2 border-border">
            {highlights.map((item) => (
              <div key={item.title} className="bg-card p-8 space-y-4">
                <div className="h-12 w-12 bg-primary/10 flex items-center justify-center text-primary">
                  <item.icon className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold">{item.title}</h2>
                <p className="text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 border-2 border-border bg-card p-8 md:p-10">
            <h2 className="text-2xl font-black tracking-tight">Our focus</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                "Give contractors one place to request and manage haul work.",
                "Help haulers find work and keep trucks productive.",
                "Capture proof, photos, tickets, and billing context as the job happens.",
                "Make public pages resilient even when private services are offline.",
              ].map((item) => (
                <div key={item} className="flex gap-3 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
}
