import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API types (not yet in all TS DOM libs)
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: Event) => void) | null;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
}
interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface ISpeechRecognitionCtor {
  new (): ISpeechRecognition;
}

type UseSpeechRecognitionOptions = {
  onFinalResult: (text: string) => void;
  lang?: string;
};

type UseSpeechRecognitionReturn = {
  interimTranscript: string;
  isListening: boolean;
  supported: boolean;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): ISpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null) as ISpeechRecognitionCtor | null;
}

export function useSpeechRecognition({
  onFinalResult,
  lang = "en-US",
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  // Start false to avoid SSR mismatch — set to real value after mount
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const keepAliveRef = useRef(false);
  const onFinalRef = useRef(onFinalResult);
  onFinalRef.current = onFinalResult;

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const buildRecognition = useCallback((): ISpeechRecognition | null => {
    const SR = getSpeechRecognitionCtor();
    if (!SR) return null;

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;

    r.onstart = () => setIsListening(true);

    r.onresult = (event: ISpeechRecognitionEvent) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (finalText) onFinalRef.current(finalText.trim());
      setInterimTranscript(interim);
    };

    r.onerror = () => {
      setInterimTranscript("");
      if (keepAliveRef.current) {
        setTimeout(() => {
          if (keepAliveRef.current) {
            const next = buildRecognition();
            if (next) {
              recognitionRef.current = next;
              next.start();
            }
          }
        }, 300);
      } else {
        setIsListening(false);
      }
    };

    r.onend = () => {
      setInterimTranscript("");
      // Web Speech API stops after silence — restart if still wanted
      if (keepAliveRef.current) {
        const next = buildRecognition();
        if (next) {
          recognitionRef.current = next;
          try { next.start(); } catch { /* ignore */ }
        }
      } else {
        setIsListening(false);
      }
    };

    return r;
  }, [lang]);

  const start = useCallback(() => {
    keepAliveRef.current = true;
    const r = buildRecognition();
    if (!r) return;
    recognitionRef.current = r;
    try { r.start(); } catch { /* ignore */ }
  }, [buildRecognition]);

  const stop = useCallback(() => {
    keepAliveRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  useEffect(() => {
    return () => {
      keepAliveRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return { interimTranscript, isListening, supported, start, stop };
}
