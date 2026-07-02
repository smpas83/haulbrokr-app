import { GlassCard, StatusPill, Waveform } from "@kip/ui";
import { classifyVoiceCommand, defaultVoiceAssistantConfig } from "@kip/voice";

const commands = [
  "Open the HaulBrokr dispatch dashboard and summarize approvals.",
  "Search Golden West memory for production line decisions.",
  "Assign a task for MerchNow photo compliance follow-up.",
  "Summarize my personal priorities for today."
].map((utterance) => classifyVoiceCommand(utterance, "personal"));

export default function Page() {
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <GlassCard title="KIP Voice Assistant" eyebrow="Talking interface" action={<StatusPill label="Streaming ready" tone="good" />}>
          <div className="rounded-[2rem] border border-cyan-200/10 bg-cyan-200/10 p-6">
            <Waveform bars={defaultVoiceAssistantConfig.waveform.bars} />
            <p className="mt-6 text-center text-lg font-semibold text-white">Push-to-talk command surface</p>
            <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-slate-300">
              Speech recognition, streaming responses, speech synthesis, waveform rendering, and conversation history share one typed voice contract.
            </p>
          </div>
        </GlassCard>

        <GlassCard title="Company-aware commands" eyebrow="Classifier output">
          <div className="space-y-3">
            {commands.map((command) => (
              <article key={command.utterance} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill label={command.workspace} tone="neutral" />
                  <StatusPill label={command.intent} tone="good" />
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{Math.round(command.confidence * 100)}% confidence</span>
                </div>
                <p className="mt-3 text-slate-200">{command.utterance}</p>
              </article>
            ))}
          </div>
        </GlassCard>
      </section>
    </main>
  );
}
