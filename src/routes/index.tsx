import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { detectVerses, type ResolvedVerse } from "@/lib/bible.functions";
import { broadcastVerse, useActiveVerse, useSettings } from "@/lib/store";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { VerseSlide } from "@/components/VerseSlide";
import { SettingsPanel } from "@/components/SettingsPanel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Settings, Sparkles, ExternalLink, X, Mic, MicOff, Radio } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WordFlow — Live Scripture" },
      { name: "description", content: "Live Bible verse display for worship." },
    ],
  }),
  component: OperatorConsole,
});

// ─── Translation detection from speech ───────────────────────────────────────

const TRANSLATION_PATTERNS: { regex: RegExp; code: string }[] = [
  { regex: /\bNIV\b|\bnew international\b/i, code: "NIV" },
  { regex: /\bESV\b|\benglish standard\b/i, code: "ESV" },
  { regex: /\bNLT\b|\bnew living\b/i, code: "NLT" },
  { regex: /\bNKJV\b|\bnew king james\b/i, code: "NKJV" },
  { regex: /\bKJV\b|\bking james\b/i, code: "KJV" },
  { regex: /\bWEB\b|\bworld english\b/i, code: "WEB" },
];

function detectTranslationFromText(text: string): string | null {
  for (const { regex, code } of TRANSLATION_PATTERNS) {
    if (regex.test(text)) return code;
  }
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

function OperatorConsole() {
  const { settings, update } = useSettings();
  const liveVerse = useActiveVerse();
  const detect = useServerFn(detectVerses);

  const [sermon, setSermon] = useState("");
  const [results, setResults] = useState<ResolvedVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastQueryRef = useRef("");
  const lastAutoRef = useRef("");
  const debounceRef = useRef<number | null>(null);

  const { interimTranscript, isListening, supported: micSupported, start: startMic, stop: stopMic } =
    useSpeechRecognition({
      onFinalResult: (text) =>
        setSermon((prev) => (prev ? prev + " " + text : text)),
    });

  const runDetect = useCallback(
    async (text: string) => {
      if (text.trim().length < 4) return;
      if (text === lastQueryRef.current) return;
      lastQueryRef.current = text;

      // Auto-switch translation if pastor mentions one
      const mentioned = detectTranslationFromText(text);
      if (mentioned && mentioned !== settings.translation) {
        update({ translation: mentioned });
        toast.info(`Translation → ${mentioned}`, { duration: 2500 });
      }
      const activeTranslation = mentioned ?? settings.translation;

      setLoading(true);
      setError(null);
      try {
        const res = await detect({
          data: {
            text,
            translation: activeTranslation,
            apibible_key: settings.apibible_key || undefined,
          },
        });
        if (res.error) setError(res.error);
        setResults(res.references);

        // Auto-display first high-confidence reference immediately
        const autoVerse = res.references.find((r) => r.confidence === "high");
        if (autoVerse && autoVerse.reference !== lastAutoRef.current) {
          lastAutoRef.current = autoVerse.reference;
          broadcastVerse({
            reference: autoVerse.reference,
            text: autoVerse.text,
            translation: autoVerse.translation,
            visible: true,
            ts: Date.now(),
          });
          toast.success(`Now displaying: ${autoVerse.reference}`, {
            description: autoVerse.translation,
            duration: 3000,
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Detection failed");
      } finally {
        setLoading(false);
      }
    },
    [detect, settings.translation, settings.apibible_key, update],
  );

  // Debounced auto-detect on transcript change
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runDetect(sermon), 1200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [sermon, runDetect]);

  const sendToScreen = (r: ResolvedVerse) => {
    lastAutoRef.current = r.reference;
    broadcastVerse({ reference: r.reference, text: r.text, translation: r.translation, visible: true, ts: Date.now() });
  };

  const clearScreen = () => {
    broadcastVerse({ reference: "", text: null, translation: settings.translation, visible: false, ts: Date.now() });
  };

  // Show last ~80 chars of transcript so operator knows it's working
  const shortTranscript = sermon.length > 80 ? "…" + sermon.slice(-80) : sermon;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">WordFlow</p>
            <p className="text-white/40 text-[10px] tracking-widest uppercase mt-0.5">
              {settings.church_name} · {settings.translation}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/display"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 rounded-md px-3 py-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open display
          </a>
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 rounded-md px-3 py-1.5 transition-colors">
                <Settings className="w-3.5 h-3.5" />
                Branding
              </button>
            </SheetTrigger>
            <SheetContent className="w-[420px] overflow-y-auto sm:max-w-[420px]">
              <SheetHeader>
                <SheetTitle className="font-display">Church branding</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <SettingsPanel settings={settings} update={update} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-[1fr_380px] gap-0 overflow-hidden">

        {/* ── Left: Preview + status ── */}
        <div className="flex flex-col p-6 gap-4 border-r border-white/10">

          {/* Projector preview */}
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-white/40">
              Projector preview
            </p>
            <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
              <VerseSlide settings={settings} verse={liveVerse} preview />
            </div>
          </div>

          {/* ON AIR status bar */}
          <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/10">
            <div className="flex items-center gap-3">
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${liveVerse.visible ? "text-amber-400" : "text-white/30"}`}>
                <Radio className={`w-3 h-3 ${liveVerse.visible ? "animate-pulse" : ""}`} />
                {liveVerse.visible ? "ON AIR" : "IDLE"}
              </span>
              {liveVerse.visible && liveVerse.reference && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="text-sm font-semibold text-white">{liveVerse.reference}</span>
                  <span className="text-xs text-white/40 bg-white/10 rounded px-2 py-0.5">
                    {liveVerse.translation}
                  </span>
                </>
              )}
            </div>
            <button
              onClick={clearScreen}
              disabled={!liveVerse.visible}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>

          <p className="text-white/25 text-[11px] text-center">
            Drag the display window to your projector — it syncs automatically
          </p>
        </div>

        {/* ── Right: Mic + detected ── */}
        <div className="flex flex-col p-6 gap-5 overflow-y-auto">

          {/* Mic control */}
          <div className="flex flex-col items-center gap-4 py-4">
            <button
              onClick={isListening ? stopMic : startMic}
              disabled={!micSupported}
              className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                isListening
                  ? "bg-red-500/20 border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.3)]"
                  : micSupported
                    ? "bg-amber-400/10 border-2 border-amber-400/60 hover:bg-amber-400/20 hover:border-amber-400 hover:shadow-[0_0_30px_rgba(251,191,36,0.2)]"
                    : "bg-white/5 border-2 border-white/10 cursor-not-allowed opacity-40"
              }`}
            >
              {isListening && (
                <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-30" />
              )}
              {isListening
                ? <MicOff className="w-8 h-8 text-red-400" />
                : <Mic className="w-8 h-8 text-amber-400" />
              }
            </button>

            <div className="text-center">
              <p className="text-sm font-semibold text-white/80">
                {isListening ? "Listening…" : micSupported ? "Tap to listen" : "Mic not available"}
              </p>
              <p className="text-[11px] text-white/40 mt-1">
                {isListening
                  ? "Detecting references automatically"
                  : micSupported
                    ? "Works best in Chrome or Edge"
                    : "Use Chrome or Edge for mic support"
                }
              </p>
            </div>

            {/* Live transcript tail */}
            {(sermon || interimTranscript) && (
              <div className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <p className="text-[11px] text-white/40 uppercase tracking-widest mb-1">Transcript</p>
                <p className="text-xs text-white/60 leading-relaxed line-clamp-3">
                  {shortTranscript}
                  {interimTranscript && (
                    <span className="text-white/30 italic"> {interimTranscript}</span>
                  )}
                </p>
                {sermon && (
                  <button
                    onClick={() => { setSermon(""); setResults([]); lastQueryRef.current = ""; lastAutoRef.current = ""; }}
                    className="text-[10px] text-white/30 hover:text-white/60 mt-1 transition-colors"
                  >
                    Clear transcript
                  </button>
                )}
              </div>
            )}

            {/* Status */}
            {loading && (
              <p className="text-[11px] text-amber-400/70 animate-pulse">Detecting references…</p>
            )}
            {error && !loading && (
              <p className="text-[11px] text-white/40 text-center max-w-[220px]">⚠ {error}</p>
            )}
          </div>

          {/* Detected references */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-white/40">
              Detected references
            </p>

            {results.length === 0 ? (
              <div className="rounded-xl border border-white/10 border-dashed p-6 text-center">
                <p className="text-xs text-white/30">
                  {isListening
                    ? "Listening for Bible references…"
                    : "Start the mic or type in the transcript box"}
                </p>
              </div>
            ) : (
              results.map((r, i) => (
                <VerseCard
                  key={`${r.reference}-${i}`}
                  verse={r}
                  active={liveVerse.visible && liveVerse.reference === r.reference}
                  onSend={() => sendToScreen(r)}
                />
              ))
            )}
          </div>

          {/* Manual transcript input (collapsed by default, available as fallback) */}
          <details className="group">
            <summary className="text-[10px] text-white/30 cursor-pointer hover:text-white/60 transition-colors select-none list-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform inline-block">›</span>
              Manual text input
            </summary>
            <textarea
              value={sermon}
              onChange={(e) => setSermon(e.target.value)}
              placeholder='Paste captions or type — e.g. "Turn to John 3:16…"'
              className="mt-2 w-full h-28 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 placeholder:text-white/20 p-3 resize-none focus:outline-none focus:border-white/20"
            />
          </details>
        </div>
      </main>
    </div>
  );
}

// ─── Verse card ───────────────────────────────────────────────────────────────

function VerseCard({ verse, active, onSend }: { verse: ResolvedVerse; active: boolean; onSend: () => void }) {
  const confDot =
    verse.confidence === "high" ? "bg-emerald-400" :
    verse.confidence === "medium" ? "bg-amber-400" : "bg-red-400";

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      active
        ? "border-amber-400/60 bg-amber-400/5 shadow-[0_0_20px_rgba(251,191,36,0.1)]"
        : "border-white/10 bg-white/5 hover:border-white/20"
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${confDot}`} />
            <span className="font-semibold text-amber-400 text-base leading-none">
              {verse.reference}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-white/40 uppercase tracking-widest">
            <span>{verse.translation}</span>
            <span>·</span>
            <span>{verse.detection_method}</span>
            {verse.confidence === "high" && verse.text && (
              <><span>·</span><span className="text-emerald-400">auto</span></>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={onSend}
          variant={active ? "secondary" : "default"}
          className="shrink-0 text-xs h-7"
        >
          {active ? "On screen" : "Display"}
        </Button>
      </div>
      <p className="text-xs text-white/70 leading-relaxed">
        {verse.text ?? (
          <span className="italic text-white/30">
            {verse.error
              ? `Couldn't fetch text — ${verse.error}`
              : "Reference detected — no specific verse to display"}
          </span>
        )}
      </p>
    </div>
  );
}
