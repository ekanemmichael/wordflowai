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
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Settings, Sparkles, Radio, ExternalLink, X, Mic, MicOff, AlertTriangle } from "lucide-react";

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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WordFlow — Live Scripture for Worship" },
      {
        name: "description",
        content:
          "Detect Bible references the moment they are spoken and display them in your church's brand.",
      },
    ],
  }),
  component: OperatorConsole,
});

function OperatorConsole() {
  const { settings, update } = useSettings();
  const liveVerse = useActiveVerse();
  const detect = useServerFn(detectVerses);

  const [sermon, setSermon] = useState("");
  const [results, setResults] = useState<ResolvedVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoDetect, setAutoDetect] = useState(true);
  const lastQueryRef = useRef("");
  const lastAutoRef = useRef("");
  const debounceRef = useRef<number | null>(null);

  const { interimTranscript, isListening, supported: micSupported, start: startMic, stop: stopMic } =
    useSpeechRecognition({
      onFinalResult: (text) =>
        setSermon((prev) => prev + (prev.length > 0 && !prev.endsWith(" ") ? " " : "") + text),
    });

  const runDetect = useCallback(
    async (text: string) => {
      if (text.trim().length < 8) return;
      if (text === lastQueryRef.current) return;
      lastQueryRef.current = text;

      // Detect if preacher mentioned a specific translation ("in the NIV", "King James", etc.)
      const mentionedTranslation = detectTranslationFromText(text);
      if (mentionedTranslation && mentionedTranslation !== settings.translation) {
        update({ translation: mentionedTranslation });
        toast.info(`Translation switched to ${mentionedTranslation}`, { duration: 3000 });
      }
      const activeTranslation = mentionedTranslation ?? settings.translation;

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

        // Auto-display: any high-confidence reference — even if verse text fetch failed
        // (VerseSlide shows "Looking up verse…" when text is null)
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
          toast.success(`Displaying: ${autoVerse.reference}`, {
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

  useEffect(() => {
    if (!autoDetect) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      runDetect(sermon);
    }, 1100);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [sermon, autoDetect, runDetect]);

  const sendToScreen = (r: ResolvedVerse) => {
    lastAutoRef.current = r.reference;
    broadcastVerse({
      reference: r.reference,
      text: r.text,
      translation: r.translation,
      visible: true,
      ts: Date.now(),
    });
  };

  const clearScreen = () => {
    broadcastVerse({
      reference: "",
      text: null,
      translation: settings.translation,
      visible: false,
      ts: Date.now(),
    });
  };

  return (
    <div className="grain-bg min-h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border/60 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="bg-gold flex h-9 w-9 items-center justify-center rounded-md">
            <Sparkles className="h-5 w-5 text-background" />
          </div>
          <div>
            <h1 className="font-display text-xl leading-none">WordFlow</h1>
            <p className="text-muted-foreground text-[10px] tracking-[0.3em] uppercase">
              {settings.church_name} · {settings.translation}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/display"
            target="_blank"
            rel="noreferrer"
            className="border-border hover:border-gold inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors"
          >
            <ExternalLink className="h-4 w-4" /> Open display
          </a>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Branding
              </Button>
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

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Left column: sermon input + detections */}
        <section className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
              <SectionLabel>Sermon input</SectionLabel>
              <div className="flex items-center gap-3">
                <label className="text-muted-foreground flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={autoDetect}
                    onChange={(e) => setAutoDetect(e.target.checked)}
                    className="accent-[var(--gold)]"
                  />
                  Auto-detect
                </label>

                {/* Mic button */}
                {micSupported ? (
                  <button
                    onClick={isListening ? stopMic : startMic}
                    title={isListening ? "Stop microphone" : "Start microphone"}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
                      isListening
                        ? "border-red-500 bg-red-500/10 text-red-400"
                        : "border-border text-muted-foreground hover:border-gold/60 hover:text-foreground"
                    }`}
                  >
                    {isListening ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                        <MicOff className="h-3.5 w-3.5" />
                        Live
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5" />
                        Mic
                      </>
                    )}
                  </button>
                ) : (
                  <span
                    title="Speech recognition requires Chrome or Edge"
                    className="text-muted-foreground flex items-center gap-1 text-xs opacity-50"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Mic unavailable
                  </span>
                )}
              </div>
            </div>

            {/* Textarea + interim overlay */}
            <div className="relative">
              <Textarea
                value={sermon}
                onChange={(e) => setSermon(e.target.value)}
                placeholder={
                  isListening
                    ? "Listening… speak naturally and verse references will be detected automatically."
                    : 'Paste live captions, or type naturally — e.g. "Turn with me to John chapter 3 verse 16…"'
                }
                className="min-h-[220px] resize-none text-base leading-relaxed"
              />
              {/* Show in-progress words while listening */}
              {interimTranscript && (
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 text-sm italic text-muted-foreground/60 leading-relaxed">
                  {interimTranscript}
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-muted-foreground text-xs">
                {loading
                  ? "Detecting references…"
                  : error
                    ? `⚠ ${error}`
                    : isListening
                      ? `Mic on · ${sermon.length} chars`
                      : `${sermon.length} chars · powered by WordFlow AI`}
              </p>
              <div className="flex gap-2">
                {sermon.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSermon("");
                      setResults([]);
                      lastQueryRef.current = "";
                      lastAutoRef.current = "";
                    }}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={loading || sermon.trim().length < 8}
                  onClick={() => {
                    lastQueryRef.current = "";
                    runDetect(sermon);
                  }}
                >
                  Detect now
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionLabel>Detected references</SectionLabel>
              <span className="text-muted-foreground text-[10px] uppercase tracking-widest">
                High confidence = auto-display · medium/low = manual
              </span>
            </div>
            {results.length === 0 ? (
              <EmptyState isListening={isListening} />
            ) : (
              results.map((r, i) => (
                <DetectedCard
                  key={`${r.reference}-${i}`}
                  verse={r}
                  active={liveVerse.visible && liveVerse.reference === r.reference}
                  onSend={() => sendToScreen(r)}
                />
              ))
            )}
          </div>
        </section>

        {/* Right column: live preview */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Live screen preview</SectionLabel>
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 text-xs ${liveVerse.visible ? "text-gold" : "text-muted-foreground"}`}
              >
                <Radio
                  className={`h-3 w-3 ${liveVerse.visible ? "animate-pulse" : ""}`}
                />
                {liveVerse.visible ? "ON AIR" : "Idle"}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={clearScreen}
                disabled={!liveVerse.visible}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </div>
          <div className="border-border aspect-video overflow-hidden rounded-xl border shadow-2xl">
            <VerseSlide settings={settings} verse={liveVerse} preview />
          </div>
          <p className="text-muted-foreground text-xs">
            Open <span className="text-gold">/display</span> in a second window
            and drag it to the projector — it stays in sync automatically.
          </p>
        </section>
      </main>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground">
      {children}
    </span>
  );
}

function EmptyState({ isListening }: { isListening: boolean }) {
  return (
    <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
      {isListening
        ? "Listening for Bible references… keep preaching!"
        : "Start typing or turn on the mic — references will surface here in under a second."}
    </div>
  );
}

function DetectedCard({
  verse,
  active,
  onSend,
}: {
  verse: ResolvedVerse;
  active: boolean;
  onSend: () => void;
}) {
  const confColor =
    verse.confidence === "high"
      ? "text-emerald-300"
      : verse.confidence === "medium"
        ? "text-amber-300"
        : "text-rose-300";

  const isAutoDisplayed = verse.confidence === "high" && verse.text;

  return (
    <div
      className={`bg-card group rounded-xl border p-4 transition-all ${
        active
          ? "border-gold shadow-[0_0_0_2px_var(--gold)]"
          : "border-border hover:border-gold/40"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-gold text-lg leading-tight">
            {verse.reference}
          </div>
          <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-widest flex-wrap">
            <span>{verse.translation}</span>
            <span>·</span>
            <span>{verse.detection_method}</span>
            <span>·</span>
            <span className={confColor}>{verse.confidence}</span>
            {isAutoDisplayed && (
              <>
                <span>·</span>
                <span className="text-emerald-300">auto-display</span>
              </>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={onSend}
          className="shrink-0"
          variant={active ? "secondary" : "default"}
        >
          {active ? "On screen" : "Send to screen"}
        </Button>
      </div>
      <p className="text-foreground/90 text-sm leading-relaxed">
        {verse.text ?? (
          <span className="italic opacity-70">
            {verse.error
              ? `Couldn't fetch verse text (${verse.error}).`
              : "Reference detected — pick a specific verse to display text."}
          </span>
        )}
      </p>
    </div>
  );
}
