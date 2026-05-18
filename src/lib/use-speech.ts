import { useCallback, useEffect, useRef, useState } from "react";

// Minimal Web Speech API types
type SRResult = { isFinal: boolean; 0: { transcript: string } };
type SREvent = { resultIndex: number; results: { length: number; [i: number]: SRResult } };
type SRError = { error: string; message?: string };
type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRError) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  }
}

export function useSpeech(opts: {
  lang?: string;
  onFinalChunk: (text: string) => void;
  onInterim?: (text: string) => void;
}) {
  const { lang = "en-US", onFinalChunk, onInterim } = opts;
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SR | null>(null);
  const wantOnRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0].transcript;
        if (r.isFinal) finalText += t;
        else interimText += t;
      }
      if (finalText) onFinalChunk(finalText);
      if (interimText && onInterim) onInterim(interimText);
    };
    rec.onerror = (e) => {
      // "no-speech" just means a quiet moment — auto-restart, don't alarm the user.
      if (e.error === "no-speech" || e.error === "aborted") {
        return;
      }
      const friendly =
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone permission denied. Click the lock icon in the address bar to allow it."
          : e.error === "audio-capture"
            ? "No microphone detected. Check your input device."
            : e.error === "network"
              ? "Speech recognition needs an internet connection."
              : e.error === "language-not-supported"
                ? "This language isn't supported by your browser's speech engine."
                : `Speech error: ${e.error}`;
      setError(friendly);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantOnRef.current = false;
        setListening(false);
      }
    };
    rec.onend = () => {
      // Auto-restart if user still wants to listen (browsers stop after silence)
      if (wantOnRef.current) {
        try {
          rec.start();
        } catch {
          /* noop */
        }
      } else {
        setListening(false);
      }
    };
    recRef.current = rec;
    return () => {
      wantOnRef.current = false;
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
  }, [lang, onFinalChunk, onInterim]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    setError(null);
    wantOnRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not start");
    }
  }, []);

  const stop = useCallback(() => {
    wantOnRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }, []);

  return { listening, supported, error, start, stop };
}
