import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { detectVerses, type ResolvedVerse } from "@/lib/bible.functions";
import {
  broadcastVerse,
  useActiveVerse,
  useSettings,
} from "@/lib/store";
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
import { Settings, Sparkles, Radio, ExternalLink, X } from "lucide-react";

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
  const debounceRef = useRef<number | null>(null);

  const runDetect = useCallback(
    async (text: string) => {
      if (text.trim().length < 8) return;
      if (text === lastQueryRef.current) return;
      lastQueryRef.current = text;
      setLoading(true);
      setError(null);
      try {
        const res = await detect({
          data: { text, translation: settings.translation },
        });
        if (res.error) setError(res.error);
        setResults(res.references);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Detection failed");
      } finally {
        setLoading(false);
      }
    },
    [detect, settings.translation],
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
                <SheetTitle className="font-display">
                  Church branding
                </SheetTitle>
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
            <div className="mb-2 flex items-center justify-between">
              <Label>Sermon transcript</Label>
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={autoDetect}
                  onChange={(e) => setAutoDetect(e.target.checked)}
                  className="accent-[var(--gold)]"
                />
                Auto-detect as you type
              </label>
            </div>
            <Textarea
              value={sermon}
              onChange={(e) => setSermon(e.target.value)}
              placeholder='Paste live captions, or type / speak naturally — e.g. "Turn with me to John chapter 3 verse 16, for God so loved the world…"'
              className="min-h-[220px] resize-none text-base leading-relaxed"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-muted-foreground text-xs">
                {loading
                  ? "Detecting references…"
                  : error
                    ? `⚠ ${error}`
                    : `${sermon.length} chars · powered by Lovable AI`}
              </p>
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

          <div className="space-y-3">
            <Label>Detected references</Label>
            {results.length === 0 ? (
              <EmptyState />
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
            <Label>Live screen preview</Label>
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground">
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
      Start typing a sermon — references will surface here in under a second.
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
  return (
    <div
      className={`bg-card group rounded-xl border p-4 transition-all ${
        active ? "border-gold shadow-[0_0_0_2px_var(--gold)]" : "border-border hover:border-gold/40"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-gold text-lg leading-tight">
            {verse.reference}
          </div>
          <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-widest">
            <span>{verse.translation}</span>
            <span>·</span>
            <span>{verse.detection_method}</span>
            <span>·</span>
            <span className={confColor}>{verse.confidence}</span>
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
              ? `Couldn't fetch verse text (${verse.error}). Try another translation.`
              : "Reference detected — pick a specific verse to display text."}
          </span>
        )}
      </p>
    </div>
  );
}
