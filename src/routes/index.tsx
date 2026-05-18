import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { fastDetect, detectVerses, type ResolvedVerse } from "@/lib/bible.functions";
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
import { Settings, Sparkles, ExternalLink, X, Mic, MicOff, Radio, BookOpen, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WordFlow — Live Scripture" },
      { name: "description", content: "Live Bible verse display for worship." },
    ],
  }),
  component: OperatorConsole,
});

const TRANSLATION_PATTERNS: { regex: RegExp; code: string }[] = [
  { regex: /\bNIV\b|\bnew international\b/i, code: "NIV" },
  { regex: /\bESV\b|\benglish standard\b/i, code: "ESV" },
  { regex: /\bNLT\b|\bnew living\b/i, code: "NLT" },
  { regex: /\bNKJV\b|\bnew king james\b/i, code: "NKJV" },
  { regex: /\bKJV\b|\bking james\b/i, code: "KJV" },
  { regex: /\bWEB\b|\bworld english\b/i, code: "WEB" },
];

function detectTranslation(text: string): string | null {
  for (const { regex, code } of TRANSLATION_PATTERNS) {
    if (regex.test(text)) return code;
  }
  return null;
}

function OperatorConsole() {
  const { settings, update } = useSettings();
  const liveVerse = useActiveVerse();
  const fast = useServerFn(fastDetect);
  const detect = useServerFn(detectVerses);

  const [sermon, setSermon] = useState("");
  const [results, setResults] = useState<ResolvedVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const lastFastRef = useRef("");  // last interim text sent to fastDetect
  const lastAutoRef = useRef(""); // last reference auto-displayed
  const lastAIRef = useRef("");   // last final text sent to AI
  const fastDebounce = useRef<number | null>(null);
  const aiDebounce = useRef<number | null>(null);

  // ── Auto-display helper ────────────────────────────────────────────────────
  const autoDisplay = useCallback((refs: ResolvedVerse[], translation?: string) => {
    const best =
      refs.find((r) => r.text && r.confidence === "high") ??
      refs.find((r) => r.text && r.confidence === "medium") ??
      refs.find((r) => r.text);
    if (!best || best.reference === lastAutoRef.current) return;
    lastAutoRef.current = best.reference;
    broadcastVerse({
      reference: best.reference,
      text: best.text,
      translation: translation ?? best.translation,
      visible: true,
      ts: Date.now(),
    });
    toast.success(`Now showing: ${best.reference}`, { description: best.translation, duration: 2500 });
  }, []);

  // ── Tier 1: instant regex on interim transcript ────────────────────────────
  const runFast = useCallback(async (text: string, translation: string) => {
    const combined = sermon + " " + text;
    if (combined.trim().length < 4) return;
    if (combined === lastFastRef.current) return;
    lastFastRef.current = combined;
    try {
      const res = await fast({ data: { text: combined, translation } });
      if (res.references.length > 0) {
        setResults((prev) => {
          // Merge: add any new refs not already in list
          const existing = new Set(prev.map((r) => r.reference));
          const newOnes = res.references.filter((r) => !existing.has(r.reference));
          return newOnes.length > 0 ? [...newOnes, ...prev].slice(0, 5) : prev;
        });
        autoDisplay(res.references, translation);
      }
    } catch { /* silent — AI path will cover */ }
  }, [fast, sermon, autoDisplay]);

  // ── Tier 2: full AI detection on final transcript ──────────────────────────
  const runAI = useCallback(async (text: string) => {
    if (text.trim().length < 4) return;
    if (text === lastAIRef.current) return;
    lastAIRef.current = text;

    const mentioned = detectTranslation(text);
    if (mentioned && mentioned !== settings.translation) {
      update({ translation: mentioned });
      toast.info(`Translation switched to ${mentioned}`, { duration: 2000 });
    }
    const translation = mentioned ?? settings.translation;

    setLoading(true);
    try {
      const res = await detect({ data: { text, translation } });
      if (res.references.length > 0) {
        setResults(res.references);
        autoDisplay(res.references, translation);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [detect, settings.translation, update, autoDisplay]);

  // ── Speech recognition ─────────────────────────────────────────────────────
  const { interimTranscript, isListening, supported: micSupported, micError, start: startMic, stop: stopMic } =
    useSpeechRecognition({
      onFinalResult: (text) => {
        const next = sermon ? sermon + " " + text : text;
        setSermon(next);
        // Kick AI with debounce after each final sentence
        if (aiDebounce.current) window.clearTimeout(aiDebounce.current);
        aiDebounce.current = window.setTimeout(() => runAI(next), 400);
      },
      onInterim: (interim) => {
        // Tier 1: fire immediately on partial speech
        if (fastDebounce.current) window.clearTimeout(fastDebounce.current);
        fastDebounce.current = window.setTimeout(() => {
          runFast(interim, settings.translation);
        }, 150); // 150ms — near-instant
      },
    });

  // Also run AI when manual textarea changes
  useEffect(() => {
    if (aiDebounce.current) window.clearTimeout(aiDebounce.current);
    aiDebounce.current = window.setTimeout(() => runAI(sermon), 800);
    return () => { if (aiDebounce.current) window.clearTimeout(aiDebounce.current); };
  }, [sermon, runAI]);

  useEffect(() => {
    return () => {
      if (fastDebounce.current) window.clearTimeout(fastDebounce.current);
      if (aiDebounce.current) window.clearTimeout(aiDebounce.current);
    };
  }, []);

  const sendToScreen = (r: ResolvedVerse) => {
    lastAutoRef.current = r.reference;
    broadcastVerse({ reference: r.reference, text: r.text, translation: r.translation, visible: true, ts: Date.now() });
  };

  const clearScreen = () => {
    broadcastVerse({ reference: "", text: null, translation: settings.translation, visible: false, ts: Date.now() });
  };

  const clearAll = () => {
    setSermon("");
    setResults([]);
    lastFastRef.current = "";
    lastAIRef.current = "";
    lastAutoRef.current = "";
  };

  const shortTranscript = sermon.length > 140 ? "…" + sermon.slice(-140) : sermon;

  return (
    <div className="min-h-screen bg-[#07070c] text-white flex flex-col font-sans">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/[0.07] backdrop-blur-sm sticky top-0 z-20 bg-[#07070c]/90">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <div>
            <p className="font-bold text-sm leading-none tracking-tight">WordFlow</p>
            <p className="text-white/35 text-[10px] tracking-[0.2em] uppercase mt-0.5">
              {settings.church_name} · {settings.translation}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/display"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white border border-white/10 hover:border-white/25 rounded-lg px-3 py-1.5 transition-all duration-200"
          >
            <ExternalLink className="w-3 h-3" />
            Open display
          </a>
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white border border-white/10 hover:border-white/25 rounded-lg px-3 py-1.5 transition-all duration-200">
                <Settings className="w-3 h-3" />
                Branding
              </button>
            </SheetTrigger>
            <SheetContent className="w-[420px] overflow-y-auto sm:max-w-[420px]">
              <SheetHeader><SheetTitle>Church branding</SheetTitle></SheetHeader>
              <div className="mt-6"><SettingsPanel settings={settings} update={update} /></div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-[1fr_400px] overflow-hidden">

        {/* ── Left: preview ── */}
        <div className="flex flex-col p-6 gap-4 border-r border-white/[0.07]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-white/30">Projector preview</p>
            <div className="flex items-center gap-2">
              {liveVerse.visible && liveVerse.reference && (
                <span className="text-[10px] text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-full px-2.5 py-0.5">
                  {liveVerse.reference} · {liveVerse.translation}
                </span>
              )}
              <button
                onClick={clearScreen}
                disabled={!liveVerse.visible}
                className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-white/[0.07] shadow-[0_0_60px_rgba(0,0,0,0.6)] relative">
            <VerseSlide settings={settings} verse={liveVerse} preview />
            {liveVerse.visible && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 border border-red-500/30">
                <Radio className="w-2.5 h-2.5 text-red-400 animate-pulse" />
                <span className="text-[10px] font-bold tracking-widest text-red-400 uppercase">On Air</span>
              </div>
            )}
          </div>

          <p className="text-white/20 text-[11px] text-center">
            Open <span className="text-amber-400/60">/display</span> in a second window and drag it to the projector
          </p>
        </div>

        {/* ── Right: mic + detections ── */}
        <div className="flex flex-col overflow-y-auto">

          {/* Mic section */}
          <div className="flex flex-col items-center gap-4 px-6 py-7 border-b border-white/[0.07]">

            <div className="relative">
              {isListening && (
                <>
                  <span className="absolute inset-0 rounded-full bg-red-500/15 animate-ping" style={{ animationDuration: "1.5s" }} />
                  <span className="absolute -inset-4 rounded-full border border-red-500/10 animate-ping" style={{ animationDuration: "2.2s" }} />
                </>
              )}
              <button
                onClick={isListening ? stopMic : startMic}
                disabled={!micSupported}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 select-none ${
                  isListening
                    ? "bg-red-500/15 border-2 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.2)]"
                    : micSupported
                      ? "bg-amber-400/10 border-2 border-amber-400/50 hover:bg-amber-400/15 hover:border-amber-400 hover:shadow-[0_0_40px_rgba(251,191,36,0.15)] active:scale-95"
                      : "bg-white/5 border-2 border-white/10 cursor-not-allowed opacity-30"
                }`}
              >
                {isListening
                  ? <MicOff className="w-7 h-7 text-red-400" />
                  : <Mic className="w-7 h-7 text-amber-400" />
                }
              </button>
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-white/80">
                {isListening ? "Listening…" : micSupported ? "Tap to start" : "Mic unavailable"}
              </p>
              <p className="text-[11px] text-white/30">
                {isListening
                  ? "Verses appear as the pastor speaks"
                  : micSupported
                    ? "Use Chrome or Edge for best results"
                    : "Switch to Chrome or Edge"}
              </p>
            </div>

            {/* Mic permission error */}
            {micError && (
              <div className="w-full rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 flex gap-2.5 animate-in slide-in-from-bottom-2 duration-300">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300/80 leading-relaxed">{micError}</p>
              </div>
            )}

            {/* Live transcript */}
            {(sermon || interimTranscript) && (
              <div className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 space-y-1.5 animate-in slide-in-from-bottom-2 duration-300">
                <p className="text-[9px] font-semibold tracking-[0.3em] uppercase text-white/25">Transcript</p>
                <p className="text-xs text-white/55 leading-relaxed">
                  {shortTranscript}
                  {interimTranscript && <span className="text-white/25 italic"> {interimTranscript}</span>}
                </p>
                <button onClick={clearAll} className="text-[10px] text-white/25 hover:text-white/50 transition-colors">
                  Clear
                </button>
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "120ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "240ms" }} />
                <span className="text-[11px] text-amber-400/60 ml-1">AI scanning…</span>
              </div>
            )}
          </div>

          {/* Detected references */}
          <div className="flex-1 px-6 py-5 space-y-3">
            <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-white/30">Detected references</p>

            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.07] border-dashed py-10">
                <BookOpen className="w-6 h-6 text-white/15" />
                <p className="text-xs text-white/25 text-center max-w-[180px] leading-relaxed">
                  {isListening ? "Listening for Bible references…" : "Tap the mic and start preaching"}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {results.map((r, i) => (
                  <VerseCard
                    key={`${r.reference}-${i}`}
                    verse={r}
                    active={liveVerse.visible && liveVerse.reference === r.reference}
                    onSend={() => sendToScreen(r)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Manual input */}
          <div className="px-6 pb-6">
            <details className="group">
              <summary className="text-[10px] text-white/25 cursor-pointer hover:text-white/50 transition-colors select-none list-none flex items-center gap-1.5 mb-2">
                <span className="group-open:rotate-90 transition-transform inline-block text-white/40">›</span>
                Manual text input
              </summary>
              <textarea
                value={sermon}
                onChange={(e) => setSermon(e.target.value)}
                placeholder='Paste captions — e.g. "Turn with me to John 3:16…"'
                className="w-full h-24 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white/60 placeholder:text-white/20 p-3 resize-none focus:outline-none focus:border-white/20 transition-colors"
              />
            </details>
          </div>
        </div>
      </main>
    </div>
  );
}

function VerseCard({ verse, active, onSend }: { verse: ResolvedVerse; active: boolean; onSend: () => void }) {
  const confDot =
    verse.confidence === "high" ? "bg-emerald-400" :
    verse.confidence === "medium" ? "bg-amber-400" : "bg-red-400";

  return (
    <div className={`group rounded-2xl border p-4 transition-all duration-300 animate-in slide-in-from-bottom-2 ${
      active
        ? "border-amber-400/40 bg-gradient-to-b from-amber-400/8 to-transparent shadow-[0_0_30px_rgba(251,191,36,0.06)]"
        : "border-white/[0.08] bg-white/[0.03] hover:border-white/15"
    }`}>
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${confDot}`} />
            <span className="font-bold text-amber-400 text-base leading-none truncate">{verse.reference}</span>
            {active && (
              <span className="flex items-center gap-1 text-[9px] font-semibold text-red-400 bg-red-400/10 rounded-full px-1.5 py-0.5">
                <Radio className="w-2 h-2 animate-pulse" /> Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/30 uppercase tracking-widest">
            <span>{verse.translation}</span>
            <span>·</span>
            <span>{verse.detection_method}</span>
          </div>
        </div>
        <Button
          size="sm"
          onClick={onSend}
          variant={active ? "secondary" : "default"}
          className={`shrink-0 text-[11px] h-7 px-3 transition-all duration-200 ${active ? "opacity-50" : "opacity-0 group-hover:opacity-100"}`}
        >
          {active ? "On screen" : "Display"}
        </Button>
      </div>

      {verse.text ? (
        <p className="text-sm text-white/70 leading-relaxed">{verse.text}</p>
      ) : (
        <p className="text-xs text-white/25 italic leading-relaxed">
          {verse.error ? `Couldn't fetch — ${verse.error}` : "Reference detected — no specific verse text"}
        </p>
      )}
    </div>
  );
}
