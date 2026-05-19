"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { detectAndFetch, detectExplicit, type ResolvedVerse } from "@/lib/bible.detect";
import { detectVerses } from "@/lib/bible.functions";
import { broadcastVerse, useActiveVerse, useSettings } from "@/lib/store";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { VerseSlide } from "@/components/VerseSlide";
import { SettingsPanel } from "@/components/SettingsPanel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Settings,
  Sparkles,
  ExternalLink,
  X,
  Mic,
  MicOff,
  Radio,
  BookOpen,
  AlertTriangle,
} from "lucide-react";

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

export default function OperatorConsole() {
  const { settings, update } = useSettings();
  const liveVerse = useActiveVerse();
  const aiDetect = useServerFn(detectVerses);

  const [sermon, setSermon] = useState("");
  const [results, setResults] = useState<ResolvedVerse[]>([]);
  const lastDisplayedRef = useRef("");
  const interimDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const display = useCallback((verse: ResolvedVerse) => {
    if (verse.reference === lastDisplayedRef.current) return;
    lastDisplayedRef.current = verse.reference;
    broadcastVerse({
      reference: verse.reference,
      text: verse.text,
      translation: verse.translation,
      visible: true,
      ts: Date.now(),
    });
    toast.success(`Now showing: ${verse.reference}`, {
      description: verse.translation,
      duration: 2500,
    });
  }, []);

  const autoDisplay = useCallback(
    (refs: ResolvedVerse[]) => {
      const best =
        refs.find((r) => r.text && r.confidence === "high") ??
        refs.find((r) => r.text) ??
        refs[0];
      if (best) display(best);
    },
    [display],
  );

  // Tier 1: client-side regex on interim speech (instant)
  const handleInterim = useCallback(
    (interim: string) => {
      if (interimDebounce.current) clearTimeout(interimDebounce.current);
      interimDebounce.current = setTimeout(async () => {
        const combined = (sermon + " " + interim).trim();
        if (combined.length < 4) return;
        if (detectExplicit(combined).length === 0) return;
        const refs = await detectAndFetch(combined, settings.translation);
        if (refs.length > 0) {
          setResults((prev) => {
            const existingRefs = new Set(prev.map((r) => r.reference));
            const fresh = refs.filter((r) => !existingRefs.has(r.reference));
            return fresh.length > 0 ? [...fresh, ...prev].slice(0, 5) : prev;
          });
          autoDisplay(refs);
        }
      }, 120);
    },
    [sermon, settings.translation, autoDisplay],
  );

  // Tier 2: client-side detection on final sentence
  const handleFinal = useCallback(
    async (text: string) => {
      const next = sermon ? sermon + " " + text : text;
      setSermon(next);

      const mentioned = detectTranslation(text);
      if (mentioned && mentioned !== settings.translation) {
        update({ translation: mentioned });
        toast.info(`Translation switched to ${mentioned}`, { duration: 2000 });
      }
      const translation = mentioned ?? settings.translation;

      const refs = await detectAndFetch(next, translation);
      if (refs.length > 0) {
        setResults(refs);
        autoDisplay(refs);
      }

      // Tier 3: AI detection (background, optional)
      if (aiDebounce.current) clearTimeout(aiDebounce.current);
      aiDebounce.current = setTimeout(async () => {
        try {
          const res = await aiDetect({ data: { text: next, translation } });
          if (res.references.length > 0) {
            setResults(res.references);
            autoDisplay(res.references);
          }
        } catch {
          /* AI unavailable — regex already handled it */
        }
      }, 500);
    },
    [sermon, settings.translation, update, autoDisplay, aiDetect],
  );

  // Manual textarea detection
  useEffect(() => {
    if (!sermon.trim()) return;
    const t = setTimeout(async () => {
      const refs = await detectAndFetch(sermon, settings.translation);
      if (refs.length > 0) {
        setResults(refs);
        autoDisplay(refs);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [sermon, settings.translation, autoDisplay]);

  useEffect(() => {
    return () => {
      if (interimDebounce.current) clearTimeout(interimDebounce.current);
      if (aiDebounce.current) clearTimeout(aiDebounce.current);
    };
  }, []);

  const {
    interimTranscript,
    isListening,
    supported: micSupported,
    micError,
    start: startMic,
    stop: stopMic,
  } = useSpeechRecognition({ onFinalResult: handleFinal, onInterim: handleInterim });

  const clearScreen = () => {
    broadcastVerse({
      reference: "",
      text: null,
      translation: settings.translation,
      visible: false,
      ts: Date.now(),
    });
    lastDisplayedRef.current = "";
  };

  const clearAll = () => {
    setSermon("");
    setResults([]);
    lastDisplayedRef.current = "";
  };

  const shortTranscript = sermon.length > 140 ? "…" + sermon.slice(-140) : sermon;

  return (
    <div className="min-h-screen bg-[#07070c] text-white flex flex-col font-sans">
      {/* Header */}
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
            className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white border border-white/10 hover:border-white/25 rounded-lg px-3 py-1.5 transition-all"
          >
            <ExternalLink className="w-3 h-3" /> Open display
          </a>
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white border border-white/10 hover:border-white/25 rounded-lg px-3 py-1.5 transition-all">
                <Settings className="w-3 h-3" /> Branding
              </button>
            </SheetTrigger>
            <SheetContent className="w-[420px] overflow-y-auto sm:max-w-[420px]">
              <SheetHeader>
                <SheetTitle>Church branding</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <SettingsPanel settings={settings} update={update} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-[1fr_400px] overflow-hidden">
        {/* Left: projector preview */}
        <div className="flex flex-col p-6 gap-4 border-r border-white/[0.07]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-white/30">
              Projector preview
            </p>
            <div className="flex items-center gap-2">
              {liveVerse.visible && liveVerse.reference && (
                <span className="text-[10px] text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-full px-2.5 py-0.5 animate-in fade-in duration-300">
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

          <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-white/[0.07] shadow-[0_0_80px_rgba(0,0,0,0.8)] relative">
            <VerseSlide settings={settings} verse={liveVerse} preview />
            {liveVerse.visible && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-md rounded-full px-2.5 py-1 border border-red-500/30 animate-in fade-in duration-500">
                <Radio className="w-2.5 h-2.5 text-red-400 animate-pulse" />
                <span className="text-[10px] font-bold tracking-widest text-red-400 uppercase">
                  On Air
                </span>
              </div>
            )}
          </div>

          <p className="text-white/20 text-[11px] text-center">
            Open <span className="text-amber-400/60">/display</span> on the second screen and drag
            it to the projector
          </p>
        </div>

        {/* Right: mic + results */}
        <div className="flex flex-col overflow-y-auto">
          {/* Mic section */}
          <div className="flex flex-col items-center gap-4 px-6 py-8 border-b border-white/[0.07]">
            <div className="relative">
              {isListening && (
                <>
                  <span
                    className="absolute inset-0 rounded-full bg-red-500/15 animate-ping"
                    style={{ animationDuration: "1.5s" }}
                  />
                  <span
                    className="absolute -inset-4 rounded-full border border-red-500/10 animate-ping"
                    style={{ animationDuration: "2s" }}
                  />
                </>
              )}
              <button
                onClick={isListening ? stopMic : startMic}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer select-none ${
                  isListening
                    ? "bg-red-500/15 border-2 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.2)]"
                    : "bg-amber-400/10 border-2 border-amber-400/50 hover:bg-amber-400/20 hover:border-amber-400 hover:shadow-[0_0_40px_rgba(251,191,36,0.15)] active:scale-95"
                }`}
              >
                {isListening ? (
                  <MicOff className="w-7 h-7 text-red-400" />
                ) : (
                  <Mic className="w-7 h-7 text-amber-400" />
                )}
              </button>
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-white/80">
                {isListening ? "Listening…" : "Tap to start"}
              </p>
              <p className="text-[11px] text-white/30">
                {isListening
                  ? "Verses appear as the pastor speaks"
                  : micSupported
                    ? "Best in Chrome or Edge"
                    : "Open in Chrome or Edge for mic support"}
              </p>
            </div>

            {micError && (
              <div className="w-full rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 flex gap-3 animate-in slide-in-from-bottom-2 duration-300">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-xs text-red-300/90 leading-relaxed font-medium">
                    Microphone access denied
                  </p>
                  <p className="text-[11px] text-red-300/60 leading-relaxed">
                    Click the 🔒 lock icon in your browser address bar → find Microphone → set it to
                    Allow → refresh the page.
                  </p>
                </div>
              </div>
            )}

            {(sermon || interimTranscript) && (
              <div className="w-full rounded-xl bg-white/[0.04] border border-white/[0.07] px-4 py-3 space-y-2 animate-in slide-in-from-bottom-2 duration-300">
                <p className="text-[9px] font-semibold tracking-[0.3em] uppercase text-white/25">
                  Transcript
                </p>
                <p className="text-xs text-white/55 leading-relaxed">
                  {shortTranscript}
                  {interimTranscript && (
                    <span className="text-white/25 italic"> {interimTranscript}</span>
                  )}
                </p>
                <button
                  onClick={clearAll}
                  className="text-[10px] text-white/25 hover:text-white/50 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Detected references */}
          <div className="flex-1 px-6 py-5 space-y-3">
            <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-white/30">
              Detected references
            </p>

            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.07] border-dashed py-12">
                <BookOpen className="w-7 h-7 text-white/10" />
                <p className="text-xs text-white/20 text-center max-w-[160px] leading-relaxed">
                  {isListening ? "Waiting for a Bible reference…" : "Tap the mic and start the service"}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {results.map((r, i) => (
                  <VerseCard
                    key={`${r.reference}-${i}`}
                    verse={r}
                    active={liveVerse.visible && liveVerse.reference === r.reference}
                    onSend={() => {
                      lastDisplayedRef.current = r.reference;
                      broadcastVerse({
                        reference: r.reference,
                        text: r.text,
                        translation: r.translation,
                        visible: true,
                        ts: Date.now(),
                      });
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Manual input */}
          <div className="px-6 pb-6">
            <details className="group">
              <summary className="text-[10px] text-white/25 cursor-pointer hover:text-white/50 transition-colors select-none list-none flex items-center gap-1.5 mb-2">
                <span className="group-open:rotate-90 transition-transform inline-block text-white/40">
                  ›
                </span>
                Manual text input
              </summary>
              <textarea
                value={sermon}
                onChange={(e) => setSermon(e.target.value)}
                placeholder='Paste or type sermon text — e.g. "Turn to John 3:16…"'
                className="w-full h-24 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white/60 placeholder:text-white/20 p-3 resize-none focus:outline-none focus:border-amber-400/30 transition-colors"
              />
            </details>
          </div>
        </div>
      </main>
    </div>
  );
}

function VerseCard({
  verse,
  active,
  onSend,
}: {
  verse: ResolvedVerse;
  active: boolean;
  onSend: () => void;
}) {
  const dot =
    verse.confidence === "high"
      ? "bg-emerald-400"
      : verse.confidence === "medium"
        ? "bg-amber-400"
        : "bg-red-400";

  return (
    <div
      className={`group rounded-2xl border p-4 transition-all duration-300 animate-in slide-in-from-bottom-2 ${
        active
          ? "border-amber-400/40 bg-gradient-to-b from-amber-400/8 to-transparent shadow-[0_0_30px_rgba(251,191,36,0.06)]"
          : "border-white/[0.08] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${dot}`} />
            <span className="font-bold text-amber-400 text-base leading-none">{verse.reference}</span>
            {active && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-400/10 rounded-full px-1.5 py-0.5">
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
        <button
          onClick={onSend}
          className={`shrink-0 text-[11px] h-7 px-3 rounded-lg font-medium transition-all duration-200 ${
            active
              ? "bg-white/10 text-white/40"
              : "bg-amber-400 text-black opacity-0 group-hover:opacity-100 hover:bg-amber-300"
          }`}
        >
          {active ? "On screen" : "Display"}
        </button>
      </div>
      {verse.text ? (
        <p className="text-sm text-white/70 leading-relaxed">{verse.text}</p>
      ) : (
        <p className="text-xs text-white/25 italic">
          {verse.error ? `Couldn't fetch — ${verse.error}` : "Reference detected — fetching verse…"}
        </p>
      )}
    </div>
  );
}
