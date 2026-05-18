import { useCallback, useEffect, useRef, useState } from "react";

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
  new(): ISpeechRecognition;
}

type UseSpeechRecognitionOptions = {
  onFinalResult: (text: string) => void;
  onInterim?: (text: string) => void;
  lang?: string;
};

type UseSpeechRecognitionReturn = {
  interimTranscript: string;
  isListening: boolean;
  supported: boolean;
  micError: string | null;
  start: () => void;
  stop: () => void;
};

function getSR(): ISpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null) as ISpeechRecognitionCtor | null;
}

export function useSpeechRecognition({
  onFinalResult,
  onInterim,
  lang = "en-US",
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [supported, setSupported] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const keepAliveRef = useRef(false);
  const onFinalRef = useRef(onFinalResult);
  const onInterimRef = useRef(onInterim);
  onFinalRef.current = onFinalResult;
  onInterimRef.current = onInterim;

  useEffect(() => { setSupported(getSR() !== null); }, []);

  const buildRecognition = useCallback((): ISpeechRecognition | null => {
    const SR = getSR();
    if (!SR) return null;

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;

    r.onstart = () => { setIsListening(true); setMicError(null); };

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
      if (interim) onInterimRef.current?.(interim);
    };

    r.onerror = (e: Event) => {
      const errorCode = (e as Event & { error?: string }).error ?? "";
      setInterimTranscript("");

      if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
        keepAliveRef.current = false;
        setIsListening(false);
        setMicError("Microphone access was denied. Click the lock icon in your browser's address bar and allow microphone access, then try again.");
        return;
      }

      if (errorCode === "no-speech" || errorCode === "audio-capture") {
        // Non-fatal — restart if still wanted
        if (keepAliveRef.current) {
          setTimeout(() => {
            if (!keepAliveRef.current) return;
            const next = buildRecognition();
            if (next) { recognitionRef.current = next; try { next.start(); } catch { /* ignore */ } }
          }, 300);
        } else {
          setIsListening(false);
        }
        return;
      }

      // Unknown error — restart if still wanted
      if (keepAliveRef.current) {
        setTimeout(() => {
          if (!keepAliveRef.current) return;
          const next = buildRecognition();
          if (next) { recognitionRef.current = next; try { next.start(); } catch { /* ignore */ } }
        }, 500);
      } else {
        setIsListening(false);
      }
    };

    r.onend = () => {
      setInterimTranscript("");
      if (keepAliveRef.current) {
        const next = buildRecognition();
        if (next) { recognitionRef.current = next; try { next.start(); } catch { /* ignore */ } }
      } else {
        setIsListening(false);
      }
    };

    return r;
  }, [lang]);

  const start = useCallback(() => {
    setMicError(null);
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
    return () => { keepAliveRef.current = false; recognitionRef.current?.stop(); };
  }, []);

  return { interimTranscript, isListening, supported, micError, start, stop };
}
